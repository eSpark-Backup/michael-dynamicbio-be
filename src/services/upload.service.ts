import { v2 as cloudinary } from "cloudinary";
import { CLOUD_CONFIG } from "../config";
import { IFileObject } from "../interfaces";
import { CLOUD_FOLDERS } from "../constants";
import { logger } from "../utils";
import { extname } from "path";
import streamifier from "streamifier";
cloudinary.config({
  cloud_name: CLOUD_CONFIG.cloudName,
  api_key: CLOUD_CONFIG.apiKey,
  api_secret: CLOUD_CONFIG.apiSecret,
});
class UploadService {
  async uploadMultipleFiles(files: IFileObject[], folderName: string) {
    return new Promise(async (resolve, reject) => {
      if (!files?.length) {
        return resolve({});
      }
      const imagesUrl = [];
      let uploadCount = 1;
      for (const file of files) {
        try {
          const uploadFile = await this.uploadFile(file, folderName);
          imagesUrl.push({
            url: (uploadFile as any)?.url,
            public_id: (uploadFile as any)?.public_id,
          });
          uploadCount++;
        } catch (err) {
          logger.error(
            `Errors in uploading file :: ${(err as Error)?.message}`
          );
          return reject(err);
        }
      }
      return resolve(imagesUrl);
    });
  }
  async uploadFile(file: IFileObject, folderName: string) {
    return new Promise((resolve, reject) => {
      const cloudStream = cloudinary.uploader.upload_stream(
        {
          resource_type: "auto",
          folder: folderName,
          filename_override: `${Date.now()}-${folderName}.${extname(
            (file as unknown as { originalname: string })?.originalname
          )}`,
        },
        function (error: any, result: any) {
          if (error) {
            reject(error);
          } else {
            logger.info(`Uploading file ${file?.fieldname}`);
            resolve(result);
          }
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
