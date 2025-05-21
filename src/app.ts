import cors from "cors";
import dotenv from "dotenv";
import { AppDataSource } from "./typeorm.config";
import { swaggerOptions } from "./swagger-config";
import swaggerJsDoc from "swagger-jsdoc";
import swaggerUi from "swagger-ui-express";
import { errorHandler } from "./middleware/errorHandler";
import express, { Request, Response, NextFunction } from "express";
import { clearUploadsFolder } from "./middleware";
import { router, ChatRouter } from "./routes";
import { Server } from "socket.io";
const userSocketIDs = new Map();
import { v4 as uuid } from "uuid";
const onlineUsers = new Set();
import {
  CHAT_JOINED,
  CHAT_LEFT,
  NEW_MESSAGE,
  NEW_MESSAGE_ALERT,
  ONLINE_USERS,
  START_TYPING,
  STOP_TYPING,
} from "./constants";
import cookieParser from "cookie-parser";
import { createServer } from "http";
const envMode = "production";
dotenv.config();
import { getSockets } from "./lib";
import { socketAuthenticator } from "./middleware";
import { Message } from "./models";
import { connectDb } from "./utils/";
import { createUser } from "./seeders/user";
import { createMessages, createSingleChats } from "./seeders/chat";
const mongoURI = process.env.ME_CONFIG_MONGODB_URL;
const app = express();
app.use(cookieParser());
const corsOptions = {
  origin: [
    "http://localhost:8080", // Local frontend URL
    "http://localhost", // Allow localhost if needed
    "https://fusion.esparkconsultants.com", // Corrected staging URL
    "https://fusion-stg.esparkconsultants.com",
  ],
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  credentials: true,
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
};

const server = createServer(app);

const io = new Server(server, {
  cors: corsOptions,
});

app.set("io", io);
// createSingleChats(20);
// createMessages(6);
app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
const swaggerSpec = swaggerJsDoc(swaggerOptions);
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

AppDataSource.initialize()
  .then(async () => {
    await connectDb(mongoURI);
    console.log("✅ SQL Database connection established successfully");
    app.use(clearUploadsFolder);
    app.use("/api", router);
    app.use("/api/chat", ChatRouter);
    const nsp = io.of("/socket");

    nsp.use((socket, next) => {
      const req = socket.request as any;
      cookieParser()(
        req,
        req.res,
        async (error: any) => await socketAuthenticator(error, socket, next)
      );
    });

    nsp.on("connect", (socket) => {
      const user = (socket as any).userId;
      socket.broadcast.emit("NEW_USER_CONNECTED", {
        message: ` has joined the chat!`,
      });

      const userId = user._id.toString();

      if (!userSocketIDs.has(userId)) {
        userSocketIDs.set(userId, []);
      }
      userSocketIDs.get(userId).push(socket.id);
      console.log(userSocketIDs);

      socket.on(NEW_MESSAGE, async ({ chatId, members, message }) => {
        const messageForRealTime = {
          content: message,
          _id: uuid(),
          sender: {
            _id: user._id,
            name: user.name,
            avatar: user.avatar,
          },
          chat: chatId,
          createdAt: new Date().toISOString(),
        };

        const messageForDB = {
          content: message,
          sender: user._id,
          chat: chatId,
        };

        const membersSocket = getSockets(members);
        if ((membersSocket as any).length > 0) {
          io.of("/socket").to(membersSocket).emit(NEW_MESSAGE, {
            chatId,
            message: messageForRealTime,
          });
          console.log("membersSocket", membersSocket);
          io.of("/socket")
            .to(membersSocket)
            .emit(NEW_MESSAGE_ALERT, { chatId });
        }
        try {
          await Message.create(messageForDB);
        } catch (error) {
          throw new Error(error);
        }
      });

      socket.on(START_TYPING, ({ members, chatId }) => {
        const membersSocket = getSockets(members);
        if ((membersSocket as any).length > 0) {
          socket.to(membersSocket).emit(START_TYPING, { chatId });
        }
      });

      socket.on(STOP_TYPING, ({ members, chatId }) => {
        const membersSocket = getSockets(members);
        if ((membersSocket as any).length > 0) {
          socket.to(membersSocket).emit(STOP_TYPING, { chatId });
        }
      });

      socket.on(CHAT_JOINED, () => {
        onlineUsers.add(user._id.toString());

        const membersSocket = getSockets();
        io.of("/socket")
          .to(membersSocket)
          .emit(ONLINE_USERS, Array.from(onlineUsers));
      });

      socket.on(CHAT_LEFT, () => {
        onlineUsers.delete(user._id.toString());

        const membersSocket = getSockets();
        io.of("/socket")
          .to(membersSocket)
          .emit(ONLINE_USERS, Array.from(onlineUsers));
      });

      socket.on("disconnect", () => {
        const userId = user._id.toString();
        if (userSocketIDs.has(userId)) {
          const sockets = userSocketIDs
            .get(userId)
            .filter((id: string) => id !== socket.id);

          if (sockets.length === 0) {
            userSocketIDs.delete(userId);
          } else {
            userSocketIDs.set(userId, sockets);
          }
        }

        // onlineUsers.delete(user._id.toString());
        socket.broadcast.emit(ONLINE_USERS, Array.from(onlineUsers));
      });
    });
    app.use(errorHandler);
  })
  .catch((error: any) => {
    console.error("❌ Error connecting to the database:", error);
  });
export { server, app, envMode, userSocketIDs };
