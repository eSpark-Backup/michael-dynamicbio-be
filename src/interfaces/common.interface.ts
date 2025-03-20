import { Request, Router } from "express";

export interface IBaseMongoModel {
  _id?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IResponseData<T = any> {
  message: string;
  data: T | null;
  status: boolean;
}

export interface IRoutes {
  path: string;
  router: Router;
}

export interface ICustomRequest<T = Record<string, any>> extends Request {
  body: T;
  user?: { role?: string; id?: string; email?: string; _id?: string };
  role?: string;
}

export interface IImagesObj {
  url?: String;
  publicId?: String;
}

export interface IQueryObject {
  page?: number;
  pageSize?: number;
}
export type EventDate = {
  startDate: string;
  endDate: string;
};

export type PricingTerm = {
  term: "Day" | "Week" | "Month" | "Year";
  price: string;
  minimum: string;
};

export type Space = {
  id: string;
  pricing: PricingTerm[];
};

export interface IFileObject {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

export interface IFileRequest extends Request {
  files: {
    cover?: Express.Multer.File[];
    image?: Express.Multer.File[];
  };
}

export interface UploadResult {
  url: string;
  public_id: string;
}
export interface Media {
  IMAGES?: UploadResult[];
  VIDEOS?: UploadResult[];
  THUMBNAILS?: UploadResult[];
  ARTICLE?:UploadResult[];
  
}