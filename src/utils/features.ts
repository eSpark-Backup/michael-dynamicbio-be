import { v2 as cloudinary } from "cloudinary";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { v4 as uuid } from "uuid";
import { getBase64, getSockets } from "../lib";
import { UploadResult } from "../interfaces";
import { CHAT_COOKIE } from "../constants";

const cookieOptions = {
  maxAge: 15 * 24 * 60 * 60 * 1000,
  sameSite: "none",
  httpOnly: true,
  secure: true,
};

const connectDb = async (uri: string, delay: number = 2000) => {
  while (true) {
    try {
      const connection = await mongoose.connect(uri, { dbName: "Fusion" });
      console.log(`✅ Connected to MongoDB: ${connection.connection.host}`);
      return connection;
    } catch (err) {
      console.error(`❌ MongoDB Connection Failed: ${err.message}`);
      console.log(`🔄 Retrying in ${delay / 1000} seconds...`);
      await new Promise((res) => setTimeout(res, delay));
    }
  }
};
const sendToken = (res: any, user: any, code: any, message: any) => {
  const token = jwt.sign({ _id: user._id }, process.env.JWT_SECRET);

  return res.status(code).cookie(CHAT_COOKIE, token, cookieOptions).json({
    success: true,
    user,
    message,
  });
};

const emitEvent = (req: any, event: any, users: any, data: any = []) => {
  const io = req.app.get("io");

  const usersSocket = getSockets(users);
  if (!usersSocket.length) return;
  io.of("/socket").to(usersSocket).emit(event, data);
};

const uploadFilesToCloudinary = async (files: UploadResult[]) => {
  const uploadPromises = files.map((file) => {
    return new Promise((resolve, reject) => {
      cloudinary.uploader.upload(
        getBase64(file),
        {
          resource_type: "auto",
          public_id: uuid(),
        },
        (error, result) => {
          if (error) return reject(error);
          resolve(result);
        }
      );
    });
  });

  try {
    const results = await Promise.all(uploadPromises);

    const formattedResults = results.map((result: any) => ({
      public_id: result.public_id,
      url: result.secure_url,
    }));

    return formattedResults;
  } catch (error) {
    throw new Error(`Error uploading files to cloudinary: ${error.message}`);
  }
};

const deleteFilesFromCloudinary = async (attachments: UploadResult[] = []) => {
  const deletePromises = attachments.map((attachment: any) => {
    const public_id =
      typeof attachment.public_id === "string"
        ? attachment.public_id
        : attachment.public_id?.public_id; // Extract nested public_id

    return new Promise((resolve, reject) => {
      cloudinary.uploader.destroy(public_id, (error: any, result: any) => {
        if (error) return reject({ public_id, error });
        resolve({ public_id, result });
      });
    });
  });

  try {
    const results: any = await Promise.all(deletePromises);

    const formattedResults = results.map(
      ({ public_id, result }: { public_id: string; result: any }) => ({
        public_id,
        deleted: result.result === "ok",
      })
    );

    return formattedResults;
  } catch (error) {
    throw new Error(`Error deleting files from Cloudinary: ${error}`);
  }
};

export {
  connectDb,
  cookieOptions,
  deleteFilesFromCloudinary,
  emitEvent,
  uploadFilesToCloudinary,
};
