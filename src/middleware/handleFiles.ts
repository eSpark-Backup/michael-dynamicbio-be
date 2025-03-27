import multer, { MulterError } from "multer";
import { Request, Response, NextFunction } from "express";
import {
  ALLOWED_IMG_TYPES,
  ALLOWED_VIDEO_TYPES,
  FILE_FIELDS,
  MAX_FILES_COUNTS,
  MULTER_ERROR,
} from "../constants";
import { ApiError } from "../errors";
import { logger } from "../utils";
import { commonHelper } from "../helpers";
import fs from "fs";
import path from "path";

const uploadsPath = path.join(process.cwd(), "uploads");

if (!fs.existsSync(uploadsPath)) {
  fs.mkdirSync(uploadsPath, { recursive: true }); // This ensures that the folder is created, including any missing parent directories
  console.log("Uploads folder created");
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsPath); // Use the uploads folder path
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, file.fieldname + "-" + uniqueSuffix + "-" + file.originalname);
  },
});

const filterFiles = (
  req: Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {
  if (ALLOWED_IMG_TYPES.includes(file.mimetype) || ALLOWED_VIDEO_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Invalid file type. Only images and videos are allowed."));
  }
};
/**
 * @description Function to handle form data
 */
export const handleMultipleFiles = (
  fields: { name: string; maxCount: number }[],
  filterFunction?: (req: Request) => void
) =>
  function (req: Request, res: Response, next: NextFunction) {
    const upload = multer({
      storage,
      fileFilter: filterFiles,
      limits: {
        fileSize: 10 * 1024 * 1024, // 10 MB
      },
    }).fields(fields);

    upload(req, res, function (err) {
      try {
        if (err) {
          handleMulterError(err);
          return res.status(400).json({ error: err.message });
        }

        if (filterFunction) {
          filterFunction(req);
        }

        return next();
      } catch (err) {
        logger.error(
          `Error in handleMultipleFiles :: ${(err as Error)?.message}`
        );
        next(err);
      }
    });
  };
export const handleSingleFile = (fieldName: FILE_FIELDS = FILE_FIELDS.FILE) =>
  function (req: Request, res: Response, next: NextFunction) {
    const upload = multer().single(fieldName);
    upload(req, res, function (err) {
      try {
        if (err) {
          handleMulterError(err);
        }
        if (Object.values(req?.body)?.length) {
          req.body = commonHelper.parseBody(req?.body);
        }
        return next();
      } catch (err) {
        logger.error(
          `Error in uploadSingleFile middleware :: ${(err as Error)?.message}`
        );
        return next(err);
      }
    });
  };
const handleMulterError = function (err: any) {
  if (err instanceof MulterError) {
    const errorMessage = MULTER_ERROR[err?.code];
    throw new ApiError(`Error in uploading file :: ${errorMessage}`, 422);
  } else {
    throw new ApiError("Error in uploading file" + err?.message, 422);
  }
};

// const filterFiles = function (req: any) {
//   if (req?.files?.length) {
//     // const isAllowedFile = req?.files?.filter(file => !ALLOWED_IMG_TYPES.includes(file?.mimetype))?.length > 0;
//     // if (isAllowedFile) throw new ApiError('Only image files are allowed', 422);
//   }
//   if (req?.file) {
//     if (!ALLOWED_IMG_TYPES.includes(req?.file?.mimetype))
//       throw new ApiError("Only image files are allowed", 422);
//   }
//   return true;
// };
