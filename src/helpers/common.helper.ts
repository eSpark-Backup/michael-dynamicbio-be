import { EntityTypes, imageExtensions } from "../constants";
import fs from "fs";
import path from "path";
import { IFileObject } from "../interfaces";
export class CommonHelper {
  createFileObject = (filePath: string, fieldname: string): IFileObject => {
    const fileBuffer = fs.readFileSync(filePath); // Read file as Buffer
    const fileStats = fs.statSync(filePath); // Get file stats (for size)

    return {
      fieldname: fieldname,
      originalname: path.basename(filePath), // Get the original filename
      encoding: "7bit", // Default encoding for files in form-data
      mimetype: "application/octet-stream", // You can modify this to get the actual MIME type
      size: fileStats.size, // File size
      buffer: fileBuffer, // File contents as Buffer
    };
  };

  assignValues(target: Record<string, any>, source: Record<string, any>) {
    for (const key in source) {
      if (source?.hasOwnProperty(key)) {
        const value = source[key];
        if (
          value !== undefined &&
          value !== null &&
          !(typeof value === "string" && value.trim() === "") &&
          !(Array.isArray(value) && value.length === 0)
        ) {
          target[key] = value;
        }
      }
    }
    return target;
  }

  parseBody(body: any) {
    const parsedBody: Record<string, any> = {};

    Object.keys(body).forEach((key) => {
      let parsedValue;
      try {
        parsedValue = JSON.parse(body[key]);
      } catch (error) {
        parsedValue = body[key];
      }
      parsedBody[key] = parsedValue;
    });
    return parsedBody;
  }

  getFileType(fileName: string) {
    const fileExtension = fileName
      .substring(fileName.lastIndexOf("."))
      .toLowerCase();

    if (imageExtensions.includes(fileExtension)) {
      return "image";
    } else {
      return "unknown";
    }
  }

  getDateAfter24Hours() {
    const currentDate = new Date();
    return new Date(currentDate.getTime() + 24 * 60 * 60 * 1000);
  }

  getDateAfterDays(days: number = 1) {
    const currentDate = new Date();
    return new Date(currentDate.getTime() + days * 24 * 60 * 60 * 1000);
  }

  reorderCoverFiles = (coverFiles: string[], coverOrder: string | string[]) => {
    if (typeof coverOrder === "string" && !Array.isArray(coverOrder)) {
      coverOrder = coverOrder.split(",").map((item) => item.trim());
    }

    const fileMap = coverFiles.reduce((map, file) => {
      const originalName = file.split("-").slice(3).join("-");
      map[originalName] = file;
      return map;
    }, {} as Record<string, string>);

    const orderedFiles = coverOrder
      .map((name) => fileMap[name])
      .filter(Boolean);

    const remainingFiles = coverFiles.filter(
      (file) => !orderedFiles.includes(file)
    );

    return [...orderedFiles, ...remainingFiles];
  };
}

export const commonHelper = new CommonHelper();
