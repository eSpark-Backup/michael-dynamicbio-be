import { NextFunction, Response } from "express";
import {Likes, Post, PostStatus, PostType, User} from "../../entity";
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
import {schedulerService} from "../../services/scheduler.service";

export class PostController {
  constructor(
    private usersRepo: Repository<User>,
    private postRepo: Repository<Post>,
    private likesRepo: Repository<Likes>
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
        scheduledDate: scheduledFor
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
          [type === PostType.EVENT ? "EVENTS" : "ARTICLES"]:
            uploadedArticleUrls,
        }) as Object) || null;
      const post = await this.postRepo.save(newPost);

      // If it's a scheduled post, create the job
      if (post.status === PostStatus.SCHEDULED && scheduledFor) {
        try {
          const job = await schedulerService.schedulePost(
              post.id,
              req.user?.id,
              new Date(scheduledFor)
          );

          // Update the post with the job ID
          post.scheduledJobId = job.id.toString();
          post.scheduledFor = scheduledFor
          await this.postRepo.save(post);
        } catch (error) {
          // If scheduling fails, still return success but log the error
          logger.error(`Failed to schedule post: ${(error as Error).message}`);
          next(error)
        }
      }

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
        oldArticleImage =
          mediaObj[
            existingPost.type === PostType.EVENT ? "EVENTS" : "ARTICLES"
          ] ?? [];
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
        [existingPost.type === PostType.EVENT ? "EVENTS" : "ARTICLES"]:
          articleImageUrls,
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
          .leftJoinAndSelect("post.likes", "like")
          .leftJoinAndSelect("like.user", "likedUser")
          .leftJoinAndSelect("like.user", "lastLikedUser") 
          .getOne();

        if (!singlePost) {
          res.status(200).json(handleResponse("Post not found"));
          return next();
        }
        praseMedia(singlePost);
        (singlePost as any).likesCount = singlePost.likes.length;
        const lastLike = singlePost.likes[0];
        (singlePost as any).lastLikedUser = lastLike ? `${lastLike.user.firstName} ${lastLike.user.lastName}` : null;
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
          .leftJoinAndSelect("post.likes", "like")
          .leftJoinAndSelect("like.user", "likedUser")
          .leftJoinAndSelect("like.user", "lastLikedUser")

          .select([
            "post",
            "author",
            "like",
            "likedUser.id",
            "likedUser.firstName",
            "likedUser.lastName",
            "lastLikedUser.firstName",
            "lastLikedUser.lastName",
          ])
          .orderBy("post.createdAt", "DESC")
          .addOrderBy("like.createdAt", "DESC")

          .skip(skipNumber)
          .take(takeNumber)
          .getManyAndCount();
        if (posts.length === 0) {
          res.status(200).json(handleResponse("No Posts Found"));
          return next();
        }
        posts.forEach((post) => {
          praseMedia(post);
          (post as any).likesCount = post.likes.length;
          const lastLike = post.likes[0];
          (post as any).lastLikedUser = lastLike ? `${lastLike.user.firstName} ${lastLike.user.lastName}` : null;
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

  // Method to schedule a post
  async schedulePost(
      req: ICustomRequest,
      res: Response,
      next: NextFunction
  ): Promise<void> {
    try {
      const { id } = req.params;
      const { scheduledDate } = req.body;

      // Validate the date
      const scheduledFor = new Date(scheduledDate);
      if (isNaN(scheduledFor.getTime())) {
        throw new ApiError("Invalid scheduled date", HTTP_STATUS.BAD_REQUEST);
      }

      // Ensure date is in the future
      if (scheduledFor.getTime() <= Date.now()) {
        throw new ApiError("Scheduled date must be in the future", HTTP_STATUS.BAD_REQUEST);
      }

      const post = await this.postRepo.findOne({
        where: { id },
        relations: ["author"]
      });

      if (!post) {
        throw new ApiError("Post not found", HTTP_STATUS.NOT_FOUND);
      }

      // Check if the user owns the post
      if (post.author.id !== req.user?.id) {
        throw new ApiError("You can only schedule your own posts", HTTP_STATUS.FORBIDDEN);
      }

      // Schedule the post with Bull
      const job = await schedulerService.schedulePost(
          post.id,
          req.user.id,
          scheduledFor
      );

      // Update post status and save scheduled date
      post.status = PostStatus.SCHEDULED;
      post.scheduledFor = scheduledFor;
      post.scheduledJobId = job.id.toString();
      await this.postRepo.save(post);

      res.status(HTTP_STATUS.OK).json(
          handleResponse("Post scheduled successfully", {
            post,
            scheduledFor,
            jobId: job.id
          })
      );
    } catch (error) {
      logger.error(`PostController :: schedulePost :: ${(error as Error)?.message}`);
      return next(error);
    }
  }

// Method to cancel a scheduled post
  async cancelScheduledPost(
      req: ICustomRequest,
      res: Response,
      next: NextFunction
  ): Promise<void> {
    try {
      const { id } = req.params;

      const post = await this.postRepo.findOne({
        where: { id },
        relations: ["author"]
      });

      if (!post) {
        throw new ApiError("Post not found", HTTP_STATUS.NOT_FOUND);
      }

      // Check if the post is scheduled
      if (post.status !== PostStatus.SCHEDULED) {
        throw new ApiError("Post is not scheduled", HTTP_STATUS.BAD_REQUEST);
      }

      // Check if the user owns the post
      if (post.author.id !== req.user?.id) {
        throw new ApiError("You can only cancel your own scheduled posts", HTTP_STATUS.FORBIDDEN);
      }

      // Cancel the scheduled post
      await schedulerService.cancelScheduledPost(post.id);

      // Update post status to DRAFT
      post.status = PostStatus.DRAFT;
      post.scheduledFor = null;
      post.scheduledJobId = null;
      await this.postRepo.save(post);

      res.status(HTTP_STATUS.OK).json(
          handleResponse("Scheduled post canceled successfully", { post })
      );
    } catch (error) {
      logger.error(`PostController :: cancelScheduledPost :: ${(error as Error)?.message}`);
      return next(error);
    }
  }

// Method to get all scheduled posts for the authenticated user
  async getScheduledPosts(
      req: ICustomRequest,
      res: Response,
      next: NextFunction
  ): Promise<void> {
    try {
      const { page, take, skip } = req?.query;
      const skipNumber = Number(skip);
      const takeNumber = Number(take);

      // Get scheduled posts from the database
      const [posts, totalItems] = await this.postRepo
          .createQueryBuilder("post")
          .where("post.author = :userId", { userId: req.user?.id })
          .andWhere("post.status = :status", { status: PostStatus.SCHEDULED })
          .leftJoinAndSelect("post.author", "author")
          .orderBy("post.scheduledFor", "ASC")
          .skip(skipNumber)
          .take(takeNumber)
          .getManyAndCount()

      if (posts.length === 0) {
        res.status(HTTP_STATUS.OK).json(handleResponse("No scheduled posts found"));
        return next();
      }

      // Process media for each post
      posts.forEach((post) => {
        if (typeof post.media === "string") {
          try {
            post.media = JSON.parse(post.media);
          } catch (error) {
            logger.error(`Error parsing media: ${(error as Error).message}`);
          }
        }
      });

      res.status(HTTP_STATUS.OK).json(
          handleResponse("Scheduled posts fetched successfully", {
            posts,
            pagination: {
              totalItems,
              currentPage: parseInt(page as string, 10),
              pageSize: takeNumber,
              totalPages: Math.ceil(totalItems / takeNumber),
            },
          })
      );
      return next()
    } catch (error) {
      logger.error(`PostController :: getScheduledPosts :: ${(error as Error)?.message}`);
      return next(error);
    }
  }

// Method to update a scheduled post
  async updateScheduledPost(
      req: ICustomRequest,
      res: Response,
      next: NextFunction
  ): Promise<void> {
    try {
      const {id} = req.params;
      const {scheduledDate} = req.body;

      // Validate the date if provided
      let scheduledFor: Date | undefined;
      if (scheduledDate) {
        scheduledFor = new Date(scheduledDate);
        if (isNaN(scheduledFor.getTime())) {
          throw new ApiError("Invalid scheduled date", HTTP_STATUS.BAD_REQUEST);
        }

        // Ensure date is in the future
        if (scheduledFor.getTime() <= Date.now()) {
          throw new ApiError("Scheduled date must be in the future", HTTP_STATUS.BAD_REQUEST);
        }
      }

      const post = await this.postRepo.findOne({
        where: {id},
        relations: ["author"]
      });

      if (!post) {
        throw new ApiError("Post not found", HTTP_STATUS.NOT_FOUND);
      }

      // Check if the post is scheduled
      if (post.status !== PostStatus.SCHEDULED) {
        throw new ApiError("Post is not scheduled", HTTP_STATUS.BAD_REQUEST);
      }

      // Check if the user owns the post
      if (post.author.id !== req.user?.id) {
        throw new ApiError("You can only update your own scheduled posts", HTTP_STATUS.FORBIDDEN);
      }

      if (scheduledFor) {
        // Cancel existing job
        await schedulerService.cancelScheduledPost(post.id);

        // Create new job with updated date
        const job = await schedulerService.schedulePost(
            post.id,
            req.user.id,
            scheduledFor
        );

        // Update post
        post.scheduledFor = scheduledFor;
        post.scheduledJobId = job.id.toString();
        await this.postRepo.save(post);
      }

      res.status(HTTP_STATUS.OK).json(
          handleResponse("Scheduled post updated successfully", {
            post,
            scheduledFor: post.scheduledFor
          })
      );
    } catch (error) {
      logger.error(`PostController :: updateScheduledPost :: ${(error as Error)?.message}`);
      return next(error);
    }
  }
}
