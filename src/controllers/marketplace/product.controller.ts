/* eslint-disable prettier/prettier */
import { Request, Response, NextFunction } from "express";
import { AppDataSource } from "../../typeorm.config";
import { Product } from "../../entity/product.entity";
import { ApiError } from "../../errors";
import { handleResponse } from "../../utils/common.utils";
import { uploadService } from "../../services/upload.service";
import { commonHelper } from "../../helpers";

const productRepository = AppDataSource.getRepository(Product);

export class ProductController {
  /**
   * Normalize multer files (array or fields -> flat array)
   */
  private static normalizeFiles(req: Request): any[] {
    if (!req.files) return [];
    if (Array.isArray(req.files)) return req.files as any[];
    return Object.values(req.files).flat() as any[];
  }

  /**
   * Convert raw multer files to IFileObject → upload → return cloud results
   */
  private static async uploadFilesIfAny(req: Request): Promise<string[]> {
    const files = ProductController.normalizeFiles(req);
    if (!files.length) return [];

    // Use the same structure as PostController
    const fileObjects = files.map((f: any) =>
      commonHelper.createFileObject(f.path, "images")
    );

    const FolderName = "marketplace/products"; // same as used in PostController
    const uploaded = await commonHelper.uploadFiles(fileObjects, FolderName);

    // Convert upload results to URLs
    return Array.isArray(uploaded)
      ? uploaded.map((f: any) => f.url || f.secure_url || "")
      : [];
  }

  /**
   * Extract public_id from Cloudinary URL
   */
  private static extractPublicIdFromUrl(url?: string): string | null {
    if (!url) return null;
    try {
      const cleaned = url.split("?")[0];
      const marker = "/upload/";
      const idx = cleaned.indexOf(marker);
      if (idx === -1) return null;

      let path = cleaned.substring(idx + marker.length);
      path = path.replace(/^v\d+\//, ""); // remove version
      const lastDot = path.lastIndexOf(".");
      if (lastDot !== -1) path = path.substring(0, lastDot);
      return decodeURIComponent(path);
    } catch {
      return null;
    }
  }

  /**
   * CREATE PRODUCT
   */
  async createProduct(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any)?.user?.id;
      if (!userId) throw new ApiError("Unauthorized", 401);

      delete req.body.userId;

      const uploaded = await ProductController.uploadFilesIfAny(req);
      const photos = uploaded;

      if (!photos.length) {
        throw new ApiError("At least one product photo is required", 400);
      }

      if (req.body.tags && typeof req.body.tags === "string") {
        try {
          req.body.tags = JSON.parse(req.body.tags);
        } catch {
          req.body.tags = req.body.tags
            .split(",")
            .map((t: string) => t.trim())
            .filter(Boolean);
        }
      }

      if (req.body.map_location && typeof req.body.map_location === "string") {
        try {
          req.body.map_location = JSON.parse(req.body.map_location);
        } catch {
          throw new ApiError("Invalid map_location format", 400);
        }
      }

      const productData = {
        ...req.body,
        userId,
        tags: Array.isArray(req.body.tags)
          ? req.body.tags
          : typeof req.body.tags === "string"
          ? req.body.tags
              .split(",")
              .map((t: string) => t.trim())
              .filter(Boolean)
          : [],
        photos,
      };

      const product = productRepository.create(productData);
      const saved = await productRepository.save(product);

      res
        .status(200)
        .json(handleResponse("Product created successfully", saved));
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET ALL
   */
  async getAllProducts(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const page = Number(req.query.page) || 1;
      const take = Number(req.query.take) || 10;
      const skip = Number(req.query.skip) || (page - 1) * take;

      const [products, totalItems] = await productRepository.findAndCount({
        order: { createdAt: "DESC" },
        skip,
        take,
      });

      if (!products.length) {
        res.status(200).json(handleResponse("No Products Found"));
        return;
      }

      res.status(200).json(
        handleResponse("Products fetched successfully", {
          products,
          pagination: {
            totalItems,
            currentPage: page,
            pageSize: take,
            totalPages: Math.ceil(totalItems / take),
          },
        })
      );
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET BY ID
   */
  async getProductById(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const product = await productRepository.findOne({ where: { id } });

      if (!product) throw new ApiError("Product not found", 404);

      res
        .status(200)
        .json(handleResponse("Product fetched successfully", product));
    } catch (err) {
      next(err);
    }
  }

  /**
   * UPDATE PRODUCT
   */
  async updateProduct(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any)?.user?.id;
      if (!userId) throw new ApiError("Unauthorized", 401);

      delete req.body.userId;

      const { id } = req.params;
      const product = await productRepository.findOne({ where: { id } });

      if (!product) throw new ApiError("Product not found", 404);

      if (product.userId !== userId) {
        throw new ApiError("Not allowed to update this product", 403);
      }

      if (req.body.tags && typeof req.body.tags === "string") {
        try {
          req.body.tags = JSON.parse(req.body.tags);
        } catch {
          req.body.tags = req.body.tags
            .split(",")
            .map((t: string) => t.trim())
            .filter(Boolean);
        }
      }

      if (req.body.map_location && typeof req.body.map_location === "string") {
        try {
          req.body.map_location = JSON.parse(req.body.map_location);
        } catch {
          throw new ApiError("Invalid map_location format", 400);
        }
      }

      const uploaded = await ProductController.uploadFilesIfAny(req);
      const photos = uploaded;

      // normalize req.body.photos
      let desired: string[] = [];
      if (req.body.photos) {
        desired = Array.isArray(req.body.photos)
          ? req.body.photos
          : typeof req.body.photos === "string"
          ? req.body.photos
              .split(",")
              .map((t: string) => t.trim())
              .filter(Boolean)
          : [];
      }

      const finalPhotos = [...desired, ...uploaded];

      // remove dropped photos
      const removed = (product.photos || []).filter(
        (p) => !finalPhotos.includes(p)
      );

      await Promise.all(
        removed.map(async (url) => {
          const id = ProductController.extractPublicIdFromUrl(url);
          if (id) {
            try {
              await uploadService.deleteFile(id);
            } catch (e: any) {
              console.warn(`Cloudinary delete failed: ${id}`, e?.message);
            }
          }
        })
      );

      const updatedData = {
        ...req.body,
        userId,
        tags: req.body.tags
          ? Array.isArray(req.body.tags)
            ? req.body.tags
            : typeof req.body.tags === "string"
            ? req.body.tags.split(",").map((t: string) => t.trim())
            : product.tags
          : product.tags,
        photos: finalPhotos.length ? finalPhotos : product.photos,
      };

      const merged = productRepository.merge(product, updatedData);
      const saved = await productRepository.save(merged);

      res
        .status(200)
        .json(handleResponse("Product updated successfully", saved));
    } catch (err) {
      next(err);
    }
  }

  /**
   * DELETE PRODUCT
   */
  async deleteProduct(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any)?.user?.id;
      if (!userId) throw new ApiError("Unauthorized", 401);

      const { id } = req.params;
      const product = await productRepository.findOne({ where: { id } });

      if (!product) throw new ApiError("Product not found", 404);

      if (product.userId !== userId) {
        throw new ApiError("Not allowed to delete this product", 403);
      }

      const photos = product.photos || [];

      await Promise.all(
        photos.map(async (url) => {
          const publicId = ProductController.extractPublicIdFromUrl(url);
          if (publicId) {
            try {
              await uploadService.deleteFile(publicId);
            } catch (err) {
              console.warn(`Failed to delete Cloudinary asset ${publicId}`);
            }
          }
        })
      );

      await productRepository.remove(product);

      res.status(200).json(handleResponse("Product deleted successfully"));
    } catch (err) {
      next(err);
    }
  }
}
