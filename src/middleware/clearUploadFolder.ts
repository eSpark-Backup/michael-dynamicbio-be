import fs from "fs";
import path from "path";
import express, { Request, Response, NextFunction } from "express";

const uploadsPath = path.join(process.cwd(), "uploads");

export const clearUploadsFolder = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    if (fs.existsSync(uploadsPath)) {
      const files = fs.readdirSync(uploadsPath);
      files.forEach((file) => {
        const filePath = path.join(uploadsPath, file);
        fs.unlinkSync(filePath);
        console.log(`Deleted file: ${filePath}`);
      });
    }
    next();
  } catch (error) {
    console.error("Error clearing uploads folder:", error);
    next(error);
  }
};
