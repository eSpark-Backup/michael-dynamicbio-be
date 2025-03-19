import { NextFunction, Response } from "express";
import { Post, PostStatus, User } from "../../entity";
import {
  ICustomRequest,
  IFileObject,
  IFileRequest,
  UploadResult,
} from "../../interfaces";
import { Repository } from "typeorm";
import fs from "fs";
import path from "path";
import { ApiError } from "../../errors";
import { CLOUD_FOLDERS, HTTP_STATUS } from "../../constants";
import { commonHelper } from "../../helpers";
import { handleResponse, logger, parseCoverImages } from "../../utils";
import { uploadService } from "../../services";
export class PostController {
  constructor(
    private usersRepo: Repository<User>,
    private postRepo: Repository<Post>
  ) {}

  async createPost(
    req: ICustomRequest,
    file: IFileRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      let { content, status, imagesOrder, videosOrder } = req.body;
      const postFilesPath = path.join(process.cwd(), "uploads");

      let postFiles = fs
        .readdirSync(postFilesPath)
        .filter((file) => file.startsWith("images"));

      let videoFiles = fs
        .readdirSync(postFilesPath)
        .filter((file) => file.startsWith("videos"));

      videosOrder = videosOrder || [];

      imagesOrder = imagesOrder || [];
      postFiles = commonHelper.reorderCoverFiles(postFiles, imagesOrder);
      videoFiles = commonHelper.reorderCoverFiles(videoFiles, videosOrder);

      const postFileObjects: IFileObject[] = postFiles.map((file) =>
        commonHelper.createFileObject(path.join(postFilesPath, file), "images")
      );
      const videoFileObjects: IFileObject[] = videoFiles.map((file) =>
        commonHelper.createFileObject(path.join(postFilesPath, file), "videos")
      );
      const userId = req.user?.id;
      const user = await this.usersRepo.findOne({ where: { id: userId } });

      const FolderName = `${CLOUD_FOLDERS.POST}/${user.firstName}_${user.lastName}`;
      const coverUrls = (await uploadService.uploadMultipleFiles(
        postFileObjects,
        FolderName
      )) as UploadResult[];

      const uploadedVideoUrls = await uploadService.uploadMultipleFiles(
        videoFileObjects,
        FolderName
      );

      const newPost = new Post();
      newPost.author = user as User;
      newPost.content = content;
      newPost.status = status;
      newPost.media =
        (JSON.stringify({
          IMAGES: coverUrls,
          VIDEOS: uploadedVideoUrls,
        }) as Object) || null;
      const post = await this.postRepo.save(newPost);

      parseCoverImages(post);
      const uploadsPath = path.join(process.cwd(), "uploads");

      const files = fs.readdirSync(uploadsPath);

      files.forEach((file) => {
        const filePath = path.join(uploadsPath, file);
        fs.unlinkSync(filePath);
        console.log(`Deleted file: ${filePath}`);
      });
      res
        .status(HTTP_STATUS.OK)
        .json(handleResponse("Post Created Successfully", post));
    } catch (error) {
      const uploadsPath = path.join(process.cwd(), "uploads");

      const files = fs.readdirSync(uploadsPath);
      if (files.length > 0) {
        files.forEach((file) => {
          const filePath = path.join(uploadsPath, file);
          fs.unlinkSync(filePath);
          logger.error(`Deleted file From Catch Block: ${filePath}`);
        });
      }
      logger.error(
        `PostController :: CreatePost :: ${(error as Error)?.message}`
      );
      return next(error);
    }
  }

  async updatePost(
    req: ICustomRequest,
    file: IFileRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const postFilesPath = path.join(process.cwd(), "uploads");
      const postFiles = fs
        .readdirSync(postFilesPath)
        .filter((file) => file.startsWith("images"));

        
      let videoFiles = fs
      .readdirSync(postFilesPath)
      .filter((file) => file.startsWith("videos"));

      const postFileObjects: IFileObject[] = postFiles.map((file) =>
        commonHelper.createFileObject(path.join(postFilesPath, file), "images")
      );
      const videoFileObjects: IFileObject[] = videoFiles.map((file) =>
        commonHelper.createFileObject(path.join(postFilesPath, file), "videos")
      );

      const { id } = req.params;
      let { content, status, imageKeys,videoKeys } = req.body;

      if (Array.isArray(imageKeys)) {
        imageKeys = imageKeys.filter((key) => typeof key === "string");
      }

      if (typeof imageKeys === "string" && !Array.isArray(imageKeys)) {
        imageKeys = imageKeys.split(",").map((item) => item.trim());
      }
      if(Array.isArray(videoKeys)){
        videoKeys = videoKeys.filter((key) => typeof key === "string");
      }
      if (typeof videoKeys === "string" && !Array.isArray(videoKeys)) {
        videoKeys = videoKeys.split(",").map((item) => item.trim());
      }

      const existingPost = await this.postRepo
        .createQueryBuilder("post")
        .where("post.id = :id", { id })
        .leftJoinAndSelect("post.author", "author")
        .getOne();
      if (!existingPost) {
        return next(res.status(404).json({ message: "Post not found" }));
      }
      if (existingPost.author.id !== req.user?.id) {
        throw new ApiError(
          "You are not authorized to update this post",
          HTTP_STATUS.UN_AUTHORIZED
        );
      }

      let oldPostImages: UploadResult[] = [];
      let oldPostVideos: UploadResult[] = [];

      const FolderName = `${CLOUD_FOLDERS.POST}/${existingPost.author.firstName}_${existingPost.author.lastName}`;
      if (typeof existingPost.media === "string") {
        try {
          oldPostImages = JSON.parse(existingPost.media) as UploadResult[];
          
        } catch (error) {
          logger.error("Failed to parse coverImages:", error);
          oldPostImages = [];
        }
      } else {
        oldPostImages = [];
      }

      const coverUrls = (
        postFileObjects?.length > 0
          ? await uploadService.uploadMultipleFiles(postFileObjects, FolderName)
          : []
      ) as UploadResult[];

      if (oldPostImages.length > 0) {
        for (const oldPostImage of oldPostImages) {
          if (imageKeys && imageKeys.length > 0) {
            const coverKeyNumbers = imageKeys
              .map((key: any) => {
                const splitKey = key.split("+");
                return {
                  key: splitKey[0],
                  order: parseInt(splitKey[1], 10),
                };
              })
              .filter((keyData: any) => !isNaN(keyData.order));

            const matchingKey = coverKeyNumbers.find((keyData: any) =>
              oldPostImage.public_id.includes(keyData.key)
            );

            if (!matchingKey) {
              await uploadService.deleteFile(oldPostImage.public_id);
            } else {
              const { order } = matchingKey;

              const validOrder = Math.max(
                1,
                Math.min(order, coverUrls.length + 1)
              );

              if (validOrder === coverUrls.length + 1) {
                coverUrls.push(oldPostImage);
              } else {
                coverUrls.splice(validOrder - 1, 0, oldPostImage);
              }
            }
          } else {
            if (
              !coverUrls.some((url) => url.public_id === oldPostImage.public_id)
            ) {
              await uploadService.deleteFile(oldPostImage.public_id);
            }
          }
        }
      }

      existingPost.media = JSON.stringify(coverUrls) as Object;
      existingPost.content = content || existingPost.content;
      existingPost.status = status || existingPost.status;

      const UpdatedPost = await this.postRepo.update(id, existingPost);
      const uploadsPath = path.join(process.cwd(), "uploads");

      const files = fs.readdirSync(uploadsPath);

      files.forEach((file) => {
        const filePath = path.join(uploadsPath, file);
        fs.unlinkSync(filePath);
      });

      res
        .status(HTTP_STATUS.OK)
        .json(handleResponse("Post Updated Successfully", UpdatedPost));
    } catch (error) {
      const uploadsPath = path.join(process.cwd(), "uploads");

      const files = fs.readdirSync(uploadsPath);

      files.forEach((file) => {
        const filePath = path.join(uploadsPath, file);
        fs.unlinkSync(filePath);
        logger.error(`Deleted file: ${filePath}`);
      });
      logger.error(
        `BrandController :: updateBrand :: ${(error as Error)?.message}`
      );
      return next(error);
    }
  }

  async getAllPost(
    req: ICustomRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { id } = req.params;
      const { page, take, skip, status } = req?.query;

      const skipNumber = Number(skip);
      const takeNumber = Number(take);
      if (id && id !== "{id}") {
        const singlePost = await this.postRepo
          .createQueryBuilder("post")
          .where("post.id = :id", { id })
          .leftJoinAndSelect("post.author", "author")

          .getOne();

        if (!singlePost) {
          res.status(200).json(handleResponse("Post not found"));
          return next();
        }

        res
          .status(200)
          .json(handleResponse("Brand Found Successfully", singlePost));
        return next();
      }
      if (true) {
        const [posts, totalItems] = await this.postRepo
          .createQueryBuilder("post")
          .where("post.author = :userId", { userId: req.user?.id })
          .leftJoinAndSelect("post.author", "author")
          // .andWhere("post.status = :status", { status: PostStatus.PUBLISH })
          .orderBy("post.createdAt", "DESC")
          .skip(skipNumber)
          .take(takeNumber)
          .getManyAndCount();

        if (posts.length === 0) {
          res.status(200).json(handleResponse("No Posts Found"));
          return next();
        }

        res.status(200).json(
          handleResponse("Brands Fetched Successfully", {
            posts,
            pagination: {
              totalItems,
              currentPage: parseInt(page as string, 10),
              pageSize: takeNumber,
              totalPages: Math.ceil(totalItems / takeNumber),
            },
          })
        );
        return next();
      }
    } catch (error) {
      next(error);
    }
  }
}
