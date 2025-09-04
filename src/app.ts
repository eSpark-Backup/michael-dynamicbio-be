import cors from "cors";
import dotenv from "dotenv";
import { AppDataSource } from "./typeorm.config";
import { swaggerOptions } from "./swagger-config";
import swaggerJsDoc from "swagger-jsdoc";
import swaggerUi from "swagger-ui-express";
import { errorHandler } from "./middleware/errorHandler";
import express from "express";
import { clearUploadsFolder } from "./middleware";
import { router, ChatRouter } from "./routes";
import { Server } from "socket.io";
import { v4 as uuid } from "uuid";
import { createServer } from "http";
import {
  CHAT_JOINED,
  CHAT_LEFT,
  NEW_MESSAGE,
  NEW_MESSAGE_ALERT,
  ONLINE_USERS,
  START_TYPING,
  STOP_TYPING,
} from "./constants";
import { getSockets } from "./lib";
import { socketAuthenticator } from "./middleware";
import { Message } from "./models";
import { connectDb } from "./utils/";

dotenv.config();

const envMode = process.env.NODE_ENV || "production";
const mongoURI = process.env.ME_CONFIG_MONGODB_URL;

const app = express();

// CORS setup
const corsOptions = {
  origin: [
    "http://localhost:8080",
    "http://localhost",
    "https://fusion.esparkconsultants.com",
    "https://fusion-stg.esparkconsultants.com",
    "https://app.h2fusion.org"
  ],
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  credentials: true,
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
};

app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Swagger
const swaggerSpec = swaggerJsDoc(swaggerOptions);
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Track socket state
const userSocketIDs = new Map<string, string[]>();
const onlineUsers = new Set<string>();

const server = createServer(app);
const io = new Server(server, {
  cors: corsOptions,
  allowEIO3: true, // fallback for polling
});

app.set("io", io);

AppDataSource.initialize()
  .then(async () => {
    await connectDb(mongoURI);
    console.log("✅ SQL & Mongo connection established successfully");

    app.use(clearUploadsFolder);
    app.use("/api", router);
    app.use("/api/chat", ChatRouter);

    const nsp = io.of("/socket");

    // 🔑 Authentication middleware
    nsp.use(async (socket, next) => {
      try {
        const cookieHeader = socket.handshake.headers.cookie || "";
        const token = cookieHeader
          .split(";")
          .find((c) => c.trim().startsWith("jwt="))
          ?.split("=")[1];

        if (!token) return next(new Error("No token provided"));
        await socketAuthenticator(token, socket, next);
      } catch (err) {
        next(err);
      }
    });

    // 🔌 Connection handler
    nsp.on("connection", (socket) => {
      const user = (socket as any).user;
      if (!user?._id) {
        console.warn("⚠️ Socket connected without valid user");
        socket.disconnect(true);
        return;
      }

      const userId = user._id.toString();

      // Track socket IDs per user
      if (!userSocketIDs.has(userId)) userSocketIDs.set(userId, []);
      userSocketIDs.get(userId)!.push(socket.id);

      console.log(`✅ User connected: ${userId}`);
      console.log("Current sockets:", userSocketIDs);

      // --- Events ---
      socket.on(NEW_MESSAGE, async ({ chatId, members, message }) => {
        const msgForRealtime = {
          content: message,
          _id: uuid(),
          sender: { _id: user._id, name: user.name, avatar: user.avatar },
          chat: chatId,
          createdAt: new Date().toISOString(),
        };
        const msgForDB = { content: message, sender: user._id, chat: chatId };

        const membersSocket = getSockets(members);
        if (membersSocket?.length) {
          nsp.to(membersSocket).emit(NEW_MESSAGE, {
            chatId,
            message: msgForRealtime,
            members,
          });
          nsp.to(membersSocket).emit(NEW_MESSAGE_ALERT, { chatId });
        }

        try {
          await Message.create(msgForDB);
        } catch (err) {
          console.error("❌ Error saving message:", err);
        }
      });

      socket.on(START_TYPING, ({ members, chatId }) => {
        const membersSocket = getSockets(members);
        if (membersSocket?.length) {
          socket.to(membersSocket).emit(START_TYPING, { chatId, userId });
        }
      });

      socket.on(STOP_TYPING, ({ members, chatId }) => {
        const membersSocket = getSockets(members);
        if (membersSocket?.length) {
          socket.to(membersSocket).emit(STOP_TYPING, { chatId, userId });
        }
      });

      socket.on(CHAT_JOINED, () => {
        onlineUsers.add(userId);
        nsp.emit(ONLINE_USERS, Array.from(onlineUsers));
      });

      socket.on(CHAT_LEFT, () => {
        onlineUsers.delete(userId);
        nsp.emit(ONLINE_USERS, Array.from(onlineUsers));
      });

      socket.on("disconnect", () => {
        console.log(`❌ User disconnected: ${userId}`);
        const sockets =
          userSocketIDs.get(userId)?.filter((id) => id !== socket.id) || [];
        if (sockets.length) userSocketIDs.set(userId, sockets);
        else userSocketIDs.delete(userId);

        onlineUsers.delete(userId);
        nsp.emit(ONLINE_USERS, Array.from(onlineUsers));
      });
    });

    app.use(errorHandler);
  })
  .catch((err) => {
    console.error("❌ Error connecting to DB:", err);
  });

export { server, app, envMode, userSocketIDs };
