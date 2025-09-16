import { v2 as cloudinary } from "cloudinary";
import { CLOUD_CONFIG } from "../config";
import { IFileObject } from "../interfaces";
import { CLOUD_FOLDERS } from "../constants";
import { logger } from "../utils";
import { extname, resolve } from "path";
import streamifier from "streamifier";
import { promisify } from "util";
cloudinary.config({
  cloud_name: CLOUD_CONFIG.cloudName,
  api_key: CLOUD_CONFIG.apiKey,
  api_secret: CLOUD_CONFIG.apiSecret,
});
class UploadService {
  async uploadMultipleFiles(files: IFileObject[], folderName: string) {
    if (!files?.length) {
      return resolve();
    }

    try {
      const uploadResults = await Promise.all(
        files.map(async (file) => {
          const uploadFile = await this.uploadFile(file, folderName);
          return {
            url: (uploadFile as any)?.url,
            public_id: (uploadFile as any)?.public_id,
          };
        })
      );

      return uploadResults;
    } catch (err) {
      logger.error(`Errors in uploading files: ${(err as Error)?.message}`);
      throw err; // Throw the error instead of rejecting manually
    }
  }

  async uploadFile(file: IFileObject, folderName: string) {
    if (!file || !file.buffer) throw new Error("Invalid file object");

    const filename = `${Date.now()}-${folderName}${extname(file.originalname)}`;

    // decide resource type
    const resourceType = file.mimetype.startsWith("video")
      ? "video"
      : file.mimetype.startsWith("image")
      ? "image"
      : "auto";

    return new Promise((resolve, reject) => {
      const cloudStream = cloudinary.uploader.upload_stream(
        {
          resource_type: resourceType,
          folder: folderName,
          filename_override: filename,
        },
        (error, result) => {
          if (error) {
            logger.error(`Upload failed for ${filename}: ${error.message}`);
            return reject(error);
          }
          logger.info(`Uploaded file: ${file?.fieldname}`);
          resolve(result);
        }
      );

      cloudStream.end(file.buffer);
    });
  }

  async deleteFile(publicId: string) {
    return cloudinary.uploader.destroy(publicId);
  }

  uploadFromBuffer = (buffer: Buffer, folder: CLOUD_FOLDERS) => {
    return new Promise((resolve, reject) => {
      let cld_upload_stream = cloudinary.uploader.upload_stream(
        {
          folder,
        },
        (error: any, result: any) => {
          if (result) {
            resolve(result);
          } else {
            reject(error);
          }
        }
      );

      streamifier.createReadStream(buffer).pipe(cld_upload_stream);
    });
  };
}

export const uploadService = new UploadService();
