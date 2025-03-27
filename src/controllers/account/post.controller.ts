import { NextFunction, Response } from "express";
import { Post, PostStatus, PostType, User } from "../../entity";
import {
  ICustomRequest,
  IFileObject,
  IFileRequest,
  Media,
  UploadResult,
} from "../../interfaces";
import { Repository } from "typeorm";
import fs from "fs";
import path from "path";
import { ApiError } from "../../errors";
import { CLOUD_FOLDERS, HTTP_STATUS } from "../../constants";
import { commonHelper } from "../../helpers";
import { handleResponse, logger, praseMedia } from "../../utils";
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
      let {
        visibility,
        type,
        content,
        status,
        imagesOrder,
        videosOrder,
        thumbnailsOrder,
      } = req.body;
      const postFilesPath = path.join(process.cwd(), "uploads");

      let postFiles = fs
        .readdirSync(postFilesPath)
        .filter((file) => file.startsWith("images"));

      let videoFiles = fs
        .readdirSync(postFilesPath)
        .filter((file) => file.startsWith("videos"));
      let thumbnailFiles = fs
        .readdirSync(postFilesPath)
        .filter((file) => file.startsWith("thumbnails"));

      let articleFiles = fs
        .readdirSync(postFilesPath)
        .filter((file) => file.startsWith("cover"));

      videosOrder = videosOrder || [];

      imagesOrder = imagesOrder || [];
      thumbnailsOrder = thumbnailsOrder || [];
      postFiles = commonHelper.reorderCoverFiles(postFiles, imagesOrder);
      videoFiles = commonHelper.reorderCoverFiles(videoFiles, videosOrder);
      thumbnailFiles = commonHelper.reorderCoverFiles(
        thumbnailFiles,
        thumbnailsOrder
      );

      if (thumbnailFiles.length === 0 && videoFiles.length > 0) {
        const videoPath = path.join(postFilesPath, videoFiles[0]);
        try {
          const thumbnailFilename = await commonHelper.generateVideoThumbnail(
            videoPath,
            postFilesPath
          );
          if (thumbnailFilename) {
            thumbnailFiles.push(thumbnailFilename);
          }
        } catch (error) {
          logger.error("Failed to generate thumbnail:", error);
        }
      }

      const postFileObjects: IFileObject[] = postFiles.map((file) =>
        commonHelper.createFileObject(path.join(postFilesPath, file), "images")
      );
      const videoFileObjects: IFileObject[] = videoFiles.map((file) =>
        commonHelper.createFileObject(path.join(postFilesPath, file), "videos")
      );
      const videoThumbnailObjects: IFileObject[] = thumbnailFiles.map((file) =>
        commonHelper.createFileObject(
          path.join(postFilesPath, file),
          "thumbnails"
        )
      );
      const articleFileObjects: IFileObject[] = articleFiles.map((file) =>
        commonHelper.createFileObject(path.join(postFilesPath, file), "cover")
      );
      const userId = req.user?.id;
      const user = await this.usersRepo.findOne({ where: { id: userId } });

      const FolderName = `${CLOUD_FOLDERS.POST}/${user.firstName}_${user.lastName}`;
      const coverUrls = postFileObjects
        ? await commonHelper.uploadFiles(postFileObjects, FolderName)
        : [];
      const uploadedVideoUrls = videoFileObjects
        ? await commonHelper.uploadFiles(videoFileObjects, FolderName)
        : [];
      const uploadedThumbnailUrls = videoThumbnailObjects
        ? await commonHelper.uploadFiles(videoThumbnailObjects, FolderName)
        : [];
      const uploadedArticleUrls = articleFileObjects
        ? await commonHelper.uploadFiles(articleFileObjects, FolderName)
        : [];

      const newPost = new Post();
      newPost.author = user as User;
      newPost.content = content;
      newPost.status = status;
      newPost.visibility = visibility;
      newPost.type = type;
      newPost.media =
        (JSON.stringify({
          IMAGES: coverUrls,
          VIDEOS: uploadedVideoUrls,
          THUMBNAILS: uploadedThumbnailUrls,
          [type === PostType.EVENT ? "EVENTS" : "ARTICLES"]: uploadedArticleUrls,
        }) as Object) || null;
      const post = await this.postRepo.save(newPost);

      praseMedia(post);
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

      let thumbnailFiles = fs
        .readdirSync(postFilesPath)
        .filter((file) => file.startsWith("thumbnails"));

      let articleFiles = fs
        .readdirSync(postFilesPath)
        .filter((file) => file.startsWith("cover"));

      if (thumbnailFiles.length === 0 && videoFiles.length > 0) {
        const videoPath = path.join(postFilesPath, videoFiles[0]);
        try {
          const thumbnailFilename = await commonHelper.generateVideoThumbnail(
            videoPath,
            postFilesPath
          );
          if (thumbnailFilename) {
            thumbnailFiles.push(thumbnailFilename);
          }
        } catch (error) {
          logger.error("Failed to generate thumbnail:", error);
        }
      }

      const postFileObjects: IFileObject[] = postFiles.map((file) =>
        commonHelper.createFileObject(path.join(postFilesPath, file), "images")
      );
      const videoFileObjects: IFileObject[] = videoFiles.map((file) =>
        commonHelper.createFileObject(path.join(postFilesPath, file), "videos")
      );
      const videoThumbnailObjects: IFileObject[] = thumbnailFiles.map((file) =>
        commonHelper.createFileObject(
          path.join(postFilesPath, file),
          "thumbnails"
        )
      );
      const articleFileObjects: IFileObject[] = articleFiles.map((file) =>
        commonHelper.createFileObject(path.join(postFilesPath, file), "cover")
      );

      const { id } = req.params;
      let {
        visibility,
        type,
        content,
        status,
        imageKeys,
        videoKeys,
        thumbnailKeys,
      } = req.body;

      imageKeys = commonHelper.normalizeKeys(imageKeys);
      videoKeys = commonHelper.normalizeKeys(videoKeys);
      thumbnailKeys = commonHelper.normalizeKeys(thumbnailKeys);

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
      let oldVideoThumbnails: UploadResult[] = [];
      let oldArticleImage: UploadResult[] = [];

      const FolderName = `${CLOUD_FOLDERS.POST}/${existingPost.author.firstName}_${existingPost.author.lastName}`;
      if (typeof existingPost.media === "string") {
        try {
          const parsedMedia: Media = JSON.parse(existingPost.media);

          oldPostImages = parsedMedia.IMAGES ?? [];
          oldPostVideos = parsedMedia.VIDEOS ?? [];
          oldVideoThumbnails = parsedMedia.THUMBNAILS ?? [];
          oldArticleImage = parsedMedia.ARTICLES ?? null;
        } catch (error) {
          logger.error("Failed to parse media:", error);
        }
      } else if (
        typeof existingPost.media === "object" &&
        existingPost.media !== null
      ) {
        const mediaObj = existingPost.media as Media;
        oldPostImages = mediaObj.IMAGES ?? [];
        oldPostVideos = mediaObj.VIDEOS ?? [];
        oldVideoThumbnails = mediaObj.THUMBNAILS ?? [];
        oldArticleImage = mediaObj[existingPost.type === PostType.EVENT ? "EVENTS" : "ARTICLES"] ?? [];



      }

      const coverUrls = postFileObjects
        ? await commonHelper.uploadFiles(postFileObjects, FolderName)
        : [];
      const uploadedVideoUrls = videoFileObjects
        ? await commonHelper.uploadFiles(videoFileObjects, FolderName)
        : [];
      const uploadedThumbnailUrls = videoThumbnailObjects
        ? await commonHelper.uploadFiles(videoThumbnailObjects, FolderName)
        : [];

      const articleImageUrls = (
        articleFileObjects?.length > 0
          ? await commonHelper.uploadFiles(articleFileObjects, FolderName)
          : [
              {
                url: oldArticleImage[0].url,
                public_id: oldArticleImage[0].public_id,
              },
            ]
      ) as UploadResult[];

      if (
        articleFileObjects &&
        oldArticleImage != null &&
        oldArticleImage[0]?.url !== (articleImageUrls[0]?.url as any)
      ) {
        await uploadService.deleteFile(articleImageUrls[0]?.public_id);
      }

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

      if (oldPostVideos.length > 0) {
        for (const oldPostVideo of oldPostVideos) {
          if (videoKeys && videoKeys.length > 0) {
            const videoKeyNumbers = videoKeys
              .map((key: any) => {
                const splitKey = key.split("+");
                return {
                  key: splitKey[0],
                  order: parseInt(splitKey[1], 10),
                };
              })
              .filter((keyData: any) => !isNaN(keyData.order));

            const matchingKey = videoKeyNumbers.find((keyData: any) =>
              oldPostVideo.public_id.includes(keyData.key)
            );

            if (!matchingKey) {
              await uploadService.deleteFile(oldPostVideo.public_id);
            } else {
              const { order } = matchingKey;

              const validOrder = Math.max(
                1,
                Math.min(order, uploadedVideoUrls.length + 1)
              );

              if (validOrder === uploadedVideoUrls.length + 1) {
                uploadedVideoUrls.push(oldPostVideo);
              } else {
                uploadedVideoUrls.splice(validOrder - 1, 0, oldPostVideo);
              }
            }
          } else {
            if (
              !uploadedVideoUrls.some(
                (url) => url.public_id === oldPostVideo.public_id
              )
            ) {
              await uploadService.deleteFile(oldPostVideo.public_id);
            }
          }
        }
      }

      if (oldVideoThumbnails.length > 0) {
        for (const oldVideoThumbnail of oldVideoThumbnails) {
          if (thumbnailKeys && thumbnailKeys.length > 0) {
            const thumbnailKeyNumbers = thumbnailKeys
              .map((key: string) => {
                const splitKey = key.split("+");
                return {
                  key: splitKey[0],
                  order: parseInt(splitKey[1], 10),
                };
              })
              .filter((keyData: any) => !isNaN(keyData.order));

            const matchingKey = thumbnailKeyNumbers.find((keyData: any) =>
              oldVideoThumbnail.public_id.includes(keyData.key)
            );

            if (!matchingKey) {
              await uploadService.deleteFile(oldVideoThumbnail.public_id);
            } else {
              const { order } = matchingKey;

              const validOrder = Math.max(
                1,
                Math.min(order, uploadedThumbnailUrls.length + 1)
              );

              if (validOrder === uploadedThumbnailUrls.length + 1) {
                uploadedThumbnailUrls.push(oldVideoThumbnail);
              } else {
                uploadedThumbnailUrls.splice(
                  validOrder - 1,
                  0,
                  oldVideoThumbnail
                );
              }
            }
          } else {
            if (
              !uploadedThumbnailUrls.some(
                (url) => url.public_id === oldVideoThumbnail.public_id
              )
            ) {
              await uploadService.deleteFile(oldVideoThumbnail.public_id);
            }
          }
        }
      }

  
      existingPost.content = content || existingPost.content;
      existingPost.status = status || existingPost.status;
      existingPost.visibility = visibility || existingPost.visibility;
      existingPost.type = type || existingPost.type;
      existingPost.media = JSON.stringify({
        IMAGES: coverUrls,
        VIDEOS: uploadedVideoUrls,
        THUMBNAILS: uploadedThumbnailUrls,
        [existingPost.type === PostType.EVENT ? "EVENTS" : "ARTICLES"]: articleImageUrls,
      }) as Object;
      

      const UpdatedPost = await this.postRepo.update(id, existingPost);
      const uploadsPath = path.join(process.cwd(), "uploads");

      const files = fs.readdirSync(uploadsPath);

      files.forEach((file) => {
        const filePath = path.join(uploadsPath, file);
        fs.unlinkSync(filePath);
        logger.error(`Deleted file: ${filePath}`);
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
        `PostController :: updatePost :: ${(error as Error)?.message}`
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
        praseMedia(singlePost);
        res
          .status(200)
          .json(handleResponse("Post Found Successfully", singlePost));
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
        posts.forEach((post) => {
          praseMedia(post);
        });

        res.status(200).json(
          handleResponse("Posts Fetched Successfully", {
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
