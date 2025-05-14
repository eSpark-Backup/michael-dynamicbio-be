import { NextFunction, Response } from "express";
import {
  Likes,
  Bond,
  Page,
  Poll,
  Post,
  PostStatus,
  PostType,
  User,
  PollVote,
  Saved,
  BondStatus,
  PostVisibility,
  COMMENT_VISIBILITY,
  Comments,
  Group,
  GroupPostRequest,
  GroupStatus,
} from "../../entity";
import {
  ICustomRequest,
  IFileObject,
  IFileRequest,
  Media,
  UploadResult,
} from "../../interfaces";
import { Brackets, Repository } from "typeorm";
import fs from "fs";
import path from "path";
import { ApiError } from "../../errors";
import { CLOUD_FOLDERS, HTTP_STATUS } from "../../constants";
import { commonHelper } from "../../helpers";
import {
  generateShareableLink,
  handleResponse,
  logger,
  praseMedia,
} from "../../utils";
import { uploadService } from "../../services";
import { schedulerService } from "../../services/scheduler.service";

export class PostController {
  constructor(
    private usersRepo: Repository<User>,
    private postRepo: Repository<Post>,
    private likesRepo: Repository<Likes>,
    private commentsRepo: Repository<Comments>,
    private pollRepo: Repository<Poll>,
    private pageRepo: Repository<Page>,
    private bondsRepo: Repository<Bond>,
    private pollVoteRepo: Repository<PollVote>,
    private savedRepo: Repository<Saved>,
    private groupRepo: Repository<Group>,
    private groupPostRequestRepo: Repository<GroupPostRequest>
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
        scheduledDate: scheduledFor,
        pageId,
        groupId,
      } = req.body;

      if (type === PostType.POLL) {
        return this.createPostWithPoll(req, res, next);
      }

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

      let page = null;
      if (pageId) {
        // Get the page
        page = await this.pageRepo
          .createQueryBuilder("page")
          .leftJoinAndSelect("page.admins", "admin")
          .where("page.id = :pageId", { pageId })
          .getOne();

        if (!page) {
          throw new ApiError("Page not found", HTTP_STATUS.NOT_FOUND);
        }

        // Check if user is an admin of the page
        const isAdmin = page.admins.some((admin) => admin.id === userId);
        if (!isAdmin) {
          throw new ApiError(
            "You are not authorized to post on this page",
            HTTP_STATUS.FORBIDDEN
          );
        }
      }

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

      if (page) {
        newPost.page = page;
        newPost.pageId = page.id;
        newPost.isPagePost = true;
      }

      newPost.media =
        (JSON.stringify({
          IMAGES: coverUrls,
          VIDEOS: uploadedVideoUrls,
          THUMBNAILS: uploadedThumbnailUrls,
          [type === PostType.EVENT ? "EVENTS" : "ARTICLES"]:
            uploadedArticleUrls,
        }) as Object) || null;
      let post = await this.postRepo.save(newPost);

      if (groupId) {
        const group = await this.groupRepo
          .createQueryBuilder("group")
          .leftJoinAndSelect("group.followers", "follower")
          .leftJoinAndSelect("group.creator", "creator")
          .leftJoinAndSelect("group.admins", "admin")
          .where("group.id = :groupId", { groupId })
          .andWhere(
            new Brackets((qb) => {
              qb.where("follower.id = :userId", { userId })
                .orWhere("creator.id = :userId", { userId })
                .orWhere("admin.id = :userId", { userId });
            })
          )
          .getOne();

        if (!group) {
          throw new ApiError(
            "Group not found or you're not a member of Group",
            HTTP_STATUS.NOT_FOUND
          );
        }

        // Check if the group requires post approval
        if (group.status == GroupStatus.PRIVATE) {
          post.visibility = PostVisibility.GROUPS;
          post.commentVisibility = COMMENT_VISIBILITY.GROUPS;
        }

        const groupPostRequest = new GroupPostRequest();
        groupPostRequest.user = user;
        groupPostRequest.group = group;
        groupPostRequest.post = post;
        await this.groupPostRequestRepo.save(groupPostRequest);
        post.group = group;
        post.groupId = group.id;
        post.isGroupPost = true;
        post = await this.postRepo.save(post);
      }

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
          post.scheduledFor = scheduledFor;
          await this.postRepo.save(post);
        } catch (error) {
          // If scheduling fails, still return success but log the error
          logger.error(`Failed to schedule post: ${(error as Error).message}`);
          next(error);
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
        commentVisibility,
        edit,
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
      if (edit) {
        existingPost.content = {
          ...existingPost.content,
          ...(content?.title && { title: content.title }),
        };
        existingPost.status = status || existingPost.status;
        existingPost.visibility = visibility || existingPost.visibility;
        existingPost.commentVisibility =
          commentVisibility || existingPost.commentVisibility;
        const UpdatedPost = await this.postRepo.update(id, existingPost);
        res
          .status(HTTP_STATUS.OK)
          .json(handleResponse("Post Updated Successfully", UpdatedPost));
        return next();
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
                url: oldArticleImage[0]?.url,
                public_id: oldArticleImage[0]?.public_id,
              },
            ]
      ) as UploadResult[];

      if (
        articleFileObjects &&
        oldArticleImage != null &&
        oldArticleImage[0]?.url !== (articleImageUrls[0]?.url as any)
      ) {
        await uploadService.deleteFile(oldArticleImage[0]?.public_id);
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
      existingPost.commentVisibility =
        commentVisibility || existingPost.commentVisibility;
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
      const userId = req.user?.id;

      const skipNumber = Number(skip);
      const takeNumber = Number(take);
      const bonds = await this.bondsRepo
        .createQueryBuilder("bond")
        .where("(bond.requesterId = :userId OR bond.recipientId = :userId)", {
          userId,
        })
        .leftJoinAndSelect("bond.requester", "requester")
        .leftJoinAndSelect("bond.recipient", "recipient")
        .andWhere("bond.status = :status", { status: BondStatus.ACCEPTED })
        .getMany();

      const bondedUserIds = bonds.map((bond) =>
        bond.requester.id === userId ? bond.recipient.id : bond.requester.id
      );

      bondedUserIds.push(userId);

      // Case 1: Get a single post by ID
      if (id && id !== "{id}") {
        const singlePost = await this.postRepo
          .createQueryBuilder("post")
          .where("post.id = :id", { id })
          .andWhere(
            new Brackets((qb) => {
              qb.where("post.author = :userId", { userId })
                .orWhere("post.visibility = :public", {
                  public: PostVisibility.PUBLIC,
                })
                .orWhere(
                  new Brackets((subQb) => {
                    subQb
                      .where("post.visibility = :connections", {
                        connections: PostVisibility.CONNECTIONS,
                      })
                      .andWhere("post.author IN (:...bondedUserIds)", {
                        bondedUserIds,
                      });
                  })
                )
                .orWhere(
                  new Brackets((groupQb) => {
                    groupQb
                      .where("post.visibility = :groups", {
                        groups: PostVisibility.GROUPS,
                      })
                      .andWhere("groupFollower.id = :userId", { userId });
                  })
                );
            })
          )
          .leftJoinAndSelect("post.author", "author")
          .leftJoinAndSelect("post.likes", "like")
          .leftJoinAndSelect("like.user", "likeUser")
          .leftJoinAndSelect("like.user", "lastLikedUser")
          .leftJoinAndSelect("post.poll", "poll") // Include poll data
          .leftJoinAndSelect("poll.votes", "pollVotes") // Include poll votes
          .leftJoinAndSelect("post.comments", "comment")
          .leftJoinAndSelect("comment.user", "commentUser")
          .leftJoinAndSelect("post.page", "page")
          .leftJoinAndSelect("page.followers", "follower")
          .leftJoinAndSelect("post.group", "group")
          .leftJoinAndSelect("group.followers", "groupFollower")

          .select([
            "post",
            "author",
            "like",

            "likeUser.id",
            "likeUser.firstName",
            "likeUser.lastName",
            "likeUser.profileImage",
            "likeUser.role",
            "likeUser.company",
            "likeUser.designation",
            "likeUser.industry",

            // "lastLikedUser.firstName",
            // "lastLikedUser.lastName",
            "poll",
            "pollVotes.id",
            "pollVotes.optionIndex",
            "pollVotes.userId",
            "comment",
            "page",
            "follower",
            "group",
            "groupFollower",
          ])
          .addOrderBy("like.createdAt", "DESC")
          .getOne();

        if (!singlePost) {
          res.status(200).json(handleResponse("Post not found"));
          return next();
        }

        let canComment = false;
        const postAuthorId = singlePost.author.id;

        switch (singlePost.commentVisibility) {
          case COMMENT_VISIBILITY.PUBLIC:
            canComment = true;
            break;

          case COMMENT_VISIBILITY.CONNECTIONS:
            canComment = bondedUserIds.includes(postAuthorId);
            break;

          case COMMENT_VISIBILITY.ONLY_ME:
            canComment = userId === postAuthorId;
            break;

          case COMMENT_VISIBILITY.GROUPS:
            canComment = singlePost.group?.followers.some(
              (follower) => follower.id === userId
            );
            break;

          default:
            canComment = false;
            break;
        }

        (singlePost as any).canComment = canComment;
        const isSaved = await this.savedRepo.find({
          where: { user: { id: userId }, post: { id } },
        });
        if (isSaved.length > 0) {
          (singlePost as any).isSaved = true;
        } else {
          (singlePost as any).isSaved = false;
        }

        const bond = await this.bondsRepo.findOne({
          where: [
            {
              requester: { id: userId },
              recipient: { id: singlePost.author.id },
            },
            {
              requester: { id: singlePost.author.id },
              recipient: { id: userId },
            },
          ],
        });
        (singlePost as any).isBond = !!bond;

        praseMedia(singlePost);
        (singlePost as any).likesCount = singlePost.likes.length;
        (singlePost as any).commentsCount = singlePost.comments.length;
        //remove the comments from post
        delete singlePost.comments;
        const lastLike = singlePost.likes[0];
        (singlePost as any).lastLikedUser = lastLike
          ? `${lastLike.user.firstName} ${lastLike.user.lastName}`
          : null;

        // If the post is a poll, include vote statistics
        if (singlePost.type === PostType.POLL && singlePost.poll) {
          const voteCounts = await this.getPollVoteCounts(singlePost.poll);
          const userVote = this.getUserPollVote(singlePost.poll, userId);

          // Only show results if poll is configured to show results or user has voted
          const shouldShowResults =
            singlePost.poll.showResults ||
            (userVote !== null && userVote !== undefined);

          (singlePost as any).pollResults = shouldShowResults
            ? voteCounts
            : null;
          (singlePost as any).userVote = userVote;
          (singlePost as any).hasVoted = userVote !== null; // Add hasVoted flag

          // Calculate poll statistics
          if (singlePost.poll.votes && singlePost.poll.votes.length > 0) {
            (singlePost as any).pollStats = {
              totalVotes: singlePost.poll.votes.length,
              hasEnded: singlePost.poll.endDate
                ? new Date() > singlePost.poll.endDate
                : false,
            };
          } else {
            (singlePost as any).pollStats = {
              totalVotes: 0,
              hasEnded: singlePost.poll.endDate
                ? new Date() > singlePost.poll.endDate
                : false,
            };
          }

          // Remove sensitive data if poll is anonymous
          if (singlePost.poll.isAnonymous) {
            delete singlePost.poll.votes;
          }
        }

        for (const like of singlePost.likes) {
          const likeUserId = like.user.id;

          const bond = await this.bondsRepo.findOne({
            where: [
              { requester: { id: userId }, recipient: { id: likeUserId } },
              { requester: { id: likeUserId }, recipient: { id: userId } },
            ],
          });

          (like as any).isBond = !!bond; // true if bond exists, false otherwise
        }
        // Get the bond between the current user and the post author
        const postAuthorBond = await this.bondsRepo.findOne({
          where: [
            {
              requester: { id: userId },
              recipient: { id: singlePost.author.id },
            },
            {
              requester: { id: singlePost.author.id },
              recipient: { id: userId },
            },
          ],
          select: ["id"],
        });

        (singlePost as any).bondId = postAuthorBond?.id || null;

        if (singlePost.page) {
          const isFollowing = singlePost.page.followers.some(
            (follower) => follower.id === userId
          );
          (singlePost as any).isPageFollowing = isFollowing;

          (singlePost as any).pageFollowerCount =
            singlePost.page.followers.length;

          delete singlePost.page.followers;
        }
        if (singlePost.group) {
          const isFollowing = singlePost.group.followers.some(
            (follower) => follower.id === userId
          );
          (singlePost as any).isGroupFollowing = isFollowing;

          (singlePost as any).groupFollowerCount =
            singlePost.group.followers.length;

          delete singlePost.group.followers;
        }

        ((singlePost as any).shareableLink = generateShareableLink({
          id: singlePost.id,
          type: "post",
          typeName: singlePost.type,
        })),
          res
            .status(200)
            .json(handleResponse("Post Found Successfully", singlePost));
        return next();
      }

      // Case 2: Get all posts for the authenticated user
      else {
        const [posts, totalItems] = await this.postRepo
          .createQueryBuilder("post")
          .where("post.author = :userId", { userId: req.user?.id })
          .leftJoinAndSelect("post.author", "author")
          .leftJoinAndSelect("post.likes", "like")
          .leftJoinAndSelect("like.user", "likedUser")
          .leftJoinAndSelect("like.user", "lastLikedUser")
          .leftJoinAndSelect("post.poll", "poll") // Include poll data
          .leftJoinAndSelect("poll.votes", "pollVotes") // Include poll votes
          .leftJoinAndSelect("post.comments", "comment")
          .leftJoinAndSelect("comment.user", "commentUser")
          .leftJoinAndSelect("post.page", "page")
          .leftJoinAndSelect("page.followers", "follower")
          .select([
            "post",
            "author",
            "like",
            "likedUser.id",
            "likedUser.firstName",
            "likedUser.lastName",
            "likedUser.profileImage",
            "likedUser.role",
            "likedUser.company",
            "likedUser.designation",
            "likedUser.industry",
            "poll", // Include poll fields
            "pollVotes.id",
            "pollVotes.optionIndex",
            "pollVotes.userId",
            "comment",
            "page",
            "follower",
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

        // Process each post
        for (const post of posts) {
          praseMedia(post);
          let canComment = false;
          const postAuthorId = post.author.id;

          switch (post.commentVisibility) {
            case COMMENT_VISIBILITY.PUBLIC:
              canComment = true;
              break;

            case COMMENT_VISIBILITY.CONNECTIONS:
              canComment = bondedUserIds.includes(postAuthorId);
              break;

            case COMMENT_VISIBILITY.ONLY_ME:
              canComment = userId === postAuthorId;
              break;
            
            case COMMENT_VISIBILITY.GROUPS:
              canComment = post.group?.followers.some(
                (follower) => follower.id === userId
              );
              break;

            default:
              canComment = false;
              break;
          }

          (post as any).canComment = canComment;

          const bond = await this.bondsRepo.findOne({
            where: [
              { requester: { id: userId }, recipient: { id: post.author.id } },
              { requester: { id: post.author.id }, recipient: { id: userId } },
            ],
          });
          (post as any).isBond = !!bond;

          ((post as any).shareableLink = generateShareableLink({
            id: post.id,
            type: "post",
            typeName: post.type,
          })),
            ((post as any).commentsCount = post.comments.length);
          (post as any).likesCount = post.likes.length;
          const lastLike = post.likes[0];
          (post as any).lastLikedUser = lastLike
            ? `${lastLike.user.firstName} ${lastLike.user.lastName}`
            : null;
          if (post.page) {
            const isFollowing = post.page.followers.some(
              (follower) => follower.id === userId
            );
            (post as any).isPageFollowing = isFollowing;

            (post as any).pageFollowerCount = post.page.followers.length;

            delete post.page.followers;
          }
          if (post.group) {
          const isFollowing = post.group.followers.some(
            (follower) => follower.id === userId
          );
          (post as any).isGroupFollowing = isFollowing;

          (post as any).groupFollowerCount =
            post.group.followers.length;

          delete post.group.followers;
        }
          for (const like of post.likes) {
            const likeUserId = like.user.id;

            const bond = await this.bondsRepo.findOne({
              where: [
                { requester: { id: userId }, recipient: { id: likeUserId } },
                { requester: { id: likeUserId }, recipient: { id: userId } },
              ],
            });

            (like as any).isBond = !!bond; // true if bond exists, false otherwise
          }

          // If the post is a poll, include vote statistics
          if (post.type === PostType.POLL && post.poll) {
            const voteCounts = await this.getPollVoteCounts(post.poll);
            const userVote = this.getUserPollVote(post.poll, userId);

            // Only show results if poll is configured to show results or user has voted
            const shouldShowResults =
              post.poll.showResults ||
              (userVote !== null && userVote !== undefined);

            (post as any).pollResults = shouldShowResults ? voteCounts : null;
            (post as any).userVote = userVote;
            (post as any).hasVoted = userVote !== null; // Add hasVoted flag

            // Calculate poll statistics
            if (post.poll.votes && post.poll.votes.length > 0) {
              (post as any).pollStats = {
                totalVotes: post.poll.votes.length,
                hasEnded: post.poll.endDate
                  ? new Date() > post.poll.endDate
                  : false,
              };
            } else {
              (post as any).pollStats = {
                totalVotes: 0,
                hasEnded: post.poll.endDate
                  ? new Date() > post.poll.endDate
                  : false,
              };
            }

            // Remove sensitive data if poll is anonymous
            if (post.poll.isAnonymous) {
              delete post.poll.votes;
            }
          }
        }

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

  // Helper method to calculate poll vote statistics
  private async getPollVoteCounts(poll: Poll): Promise<any[]> {
    if (!poll || !poll.options) {
      return [];
    }

    // Get all votes for this poll with user details
    const votes = await this.pollVoteRepo.find({
      where: { pollId: poll.id },
      relations: ["user"],
    });

    const totalVotes = votes.length;

    // Count votes for each option
    const voteCounts = poll.options.map((option, index) => {
      const optionVotes = votes.filter((vote) => vote.optionIndex === index);

      // Get user details for each vote if the poll is not anonymous
      const voteDetails = poll.isAnonymous
        ? []
        : optionVotes.map((vote) => ({
            userId: vote.userId,
            firstName: vote.user.firstName,
            lastName: vote.user.lastName,
            profileImage: vote.user.profileImage,
            company: vote.user.company,
            designation: vote.user.designation,
          }));

      return {
        option,
        optionIndex: index,
        count: optionVotes.length,
        percentage:
          totalVotes > 0
            ? Math.round((optionVotes.length / totalVotes) * 100)
            : 0,
        voters: voteDetails, // Only included if poll is not anonymous
      };
    });

    return voteCounts;
  }

  // Helper method to check if a user has voted on a poll and return their vote
  private getUserPollVote(poll: Poll, userId: string): number | null {
    if (!poll || !poll.votes || !userId) {
      return null;
    }

    // Find the user's vote
    const userVote = poll.votes.find((vote) => vote.userId === userId);

    // Return the option index if found, otherwise null
    return userVote ? userVote.optionIndex : null;
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
        throw new ApiError(
          "Scheduled date must be in the future",
          HTTP_STATUS.BAD_REQUEST
        );
      }

      const post = await this.postRepo.findOne({
        where: { id },
        relations: ["author"],
      });

      if (!post) {
        throw new ApiError("Post not found", HTTP_STATUS.NOT_FOUND);
      }

      // Check if the user owns the post
      if (post.author.id !== req.user?.id) {
        throw new ApiError(
          "You can only schedule your own posts",
          HTTP_STATUS.FORBIDDEN
        );
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
          jobId: job.id,
        })
      );
    } catch (error) {
      logger.error(
        `PostController :: schedulePost :: ${(error as Error)?.message}`
      );
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
        relations: ["author"],
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
        throw new ApiError(
          "You can only cancel your own scheduled posts",
          HTTP_STATUS.FORBIDDEN
        );
      }

      // Cancel the scheduled post
      await schedulerService.cancelScheduledPost(post.id);

      // Update post status to DRAFT
      post.status = PostStatus.DRAFT;
      post.scheduledFor = null;
      post.scheduledJobId = null;
      await this.postRepo.save(post);

      res
        .status(HTTP_STATUS.OK)
        .json(handleResponse("Scheduled post canceled successfully", { post }));
    } catch (error) {
      logger.error(
        `PostController :: cancelScheduledPost :: ${(error as Error)?.message}`
      );
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
        .getManyAndCount();

      if (posts.length === 0) {
        res
          .status(HTTP_STATUS.OK)
          .json(handleResponse("No scheduled posts found"));
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
      return next();
    } catch (error) {
      logger.error(
        `PostController :: getScheduledPosts :: ${(error as Error)?.message}`
      );
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
      const { id } = req.params;
      const { scheduledDate } = req.body;

      // Validate the date if provided
      let scheduledFor: Date | undefined;
      if (scheduledDate) {
        scheduledFor = new Date(scheduledDate);
        if (isNaN(scheduledFor.getTime())) {
          throw new ApiError("Invalid scheduled date", HTTP_STATUS.BAD_REQUEST);
        }

        // Ensure date is in the future
        if (scheduledFor.getTime() <= Date.now()) {
          throw new ApiError(
            "Scheduled date must be in the future",
            HTTP_STATUS.BAD_REQUEST
          );
        }
      }

      const post = await this.postRepo.findOne({
        where: { id },
        relations: ["author"],
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
        throw new ApiError(
          "You can only update your own scheduled posts",
          HTTP_STATUS.FORBIDDEN
        );
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
          scheduledFor: post.scheduledFor,
        })
      );
    } catch (error) {
      logger.error(
        `PostController :: updateScheduledPost :: ${(error as Error)?.message}`
      );
      return next(error);
    }
  }

  async createPostWithPoll(
    req: ICustomRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      // Get the post data
      const { poll, content, status, visibility, type } = req.body;

      if (type !== PostType.POLL) {
        throw new ApiError("Post type must be POLL", HTTP_STATUS.BAD_REQUEST);
      }

      if (!poll || !poll.question || !poll.options || poll.options.length < 2) {
        throw new ApiError(
          "Poll must have a question and at least 2 options",
          HTTP_STATUS.BAD_REQUEST
        );
      }

      const userId = req.user?.id;
      const user = await this.usersRepo.findOne({ where: { id: userId } });

      // Create the post
      const newPost = new Post();
      newPost.author = user as User;
      newPost.content = content;
      newPost.status = status;
      newPost.visibility = visibility;
      newPost.type = PostType.POLL;

      // Save the post first to get its ID
      const savedPost = await this.postRepo.save(newPost);

      // Create the poll
      const newPoll = new Poll();
      newPoll.question = poll.question;
      newPoll.options = poll.options;
      newPoll.endDate = poll.endDate ? new Date(poll.endDate) : null;
      newPoll.allowMultipleVotes = poll.allowMultipleVotes || false;
      newPoll.showResults =
        poll.showResults !== undefined ? poll.showResults : true;
      newPoll.isAnonymous = poll.isAnonymous || false;
      newPoll.allowAddOptions = poll.allowAddOptions || false;
      newPoll.postId = savedPost.id;

      // Save the poll
      const savedPoll = await this.pollRepo.save(newPoll);

      // Update the post with the poll reference (if needed in your schema)
      // This step might not be necessary depending on your entity design

      // Return the created post with poll
      const postWithPoll = await this.postRepo.findOne({
        where: { id: savedPost.id },
        relations: ["author", "poll"],
      });

      res
        .status(HTTP_STATUS.CREATED)
        .json(handleResponse("Poll post created successfully", postWithPoll));
    } catch (error) {
      logger.error(
        `PostController :: createPostWithPoll :: ${(error as Error)?.message}`
      );
      return next(error);
    }
  }

  async getPagePosts(
    req: ICustomRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { pageId } = req.params;
      const { page, take, skip } = req?.query;
      const userId = req.user?.id;

      const skipNumber = Number(skip);
      const takeNumber = Number(take);

      // First check if the page exists
      const pageEntity = await this.pageRepo.findOne({
        where: { id: pageId },
        relations: ["followers"],
      });
      if (!pageEntity) {
        throw new ApiError("Page not found", HTTP_STATUS.NOT_FOUND);
      }

      if (pageEntity) {
        const isFollowing = pageEntity.followers.some(
          (follower) => follower.id === userId
        );
        (pageEntity as any).isPageFollowing = isFollowing;

        (pageEntity as any).pageFollowerCount = pageEntity.followers.length;

        delete pageEntity.followers;
      }
      const bonds = await this.bondsRepo
        .createQueryBuilder("bond")
        .where("(bond.requesterId = :userId OR bond.recipientId = :userId)", {
          userId,
        })
        .leftJoinAndSelect("bond.requester", "requester")
        .leftJoinAndSelect("bond.recipient", "recipient")
        .andWhere("bond.status = :status", { status: BondStatus.ACCEPTED })
        .getMany();

      const bondedUserIds = bonds.map((bond) =>
        bond.requester.id === userId ? bond.recipient.id : bond.requester.id
      );

      bondedUserIds.push(userId);

      // Get posts for the page
      const [posts, totalItems] = await this.postRepo
        .createQueryBuilder("post")
        .where("post.pageId = :pageId", { pageId })
        .andWhere("post.status = :status", { status: PostStatus.PUBLISH })
        .leftJoinAndSelect("post.author", "author")
        .leftJoinAndSelect("post.likes", "like")
        .leftJoinAndSelect("like.user", "likedUser")
        .leftJoinAndSelect("post.page", "page")
        .leftJoinAndSelect("post.comments", "comment")
        .leftJoinAndSelect("comment.user", "commentUser")
        .leftJoinAndSelect("page.followers", "follower")

        .select([
          "post",
          "author.id",
          "author.firstName",
          "author.lastName",
          "author.profileImage",
          "like",
          "likedUser.id",
          "likedUser.firstName",
          "likedUser.lastName",
          "page.id",
          "page.name",
          "page.logoUrl",
          "comment",
          "follower",
        ])
        .orderBy("post.createdAt", "DESC")
        .skip(skipNumber)
        .take(takeNumber)
        .getManyAndCount();

      if (posts.length === 0) {
        res
          .status(HTTP_STATUS.OK)
          .json(handleResponse("No posts found for this page"));
        return next();
      }

      // Process posts
      for (const post of posts) {
        praseMedia(post);
        let canComment = false;
        const postAuthorId = post.author.id;

        switch (post.commentVisibility) {
          case COMMENT_VISIBILITY.PUBLIC:
            canComment = true;
            break;

          case COMMENT_VISIBILITY.CONNECTIONS:
            canComment = bondedUserIds.includes(postAuthorId);
            break;

          case COMMENT_VISIBILITY.ONLY_ME:
            canComment = userId === postAuthorId;
            break;

          default:
            canComment = false;
            break;
        }

        (post as any).canComment = canComment;

        const bond = await this.bondsRepo.findOne({
          where: [
            { requester: { id: userId }, recipient: { id: post.author.id } },
            { requester: { id: post.author.id }, recipient: { id: userId } },
          ],
        });
        (post as any).isBond = !!bond;

        ((post as any).shareableLink = generateShareableLink({
          id: post.id,
          type: "post",
          typeName: post.type,
        })),
          ((post as any).commentsCount = post.comments.length);
        (post as any).likesCount = post.likes.length;
        const lastLike = post.likes[0];
        (post as any).lastLikedUser = lastLike
          ? `${lastLike.user.firstName} ${lastLike.user.lastName}`
          : null;
        if (post.page) {
          const isFollowing = post.page.followers.some(
            (follower) => follower.id === userId
          );
          (post as any).isPageFollowing = isFollowing;

          (post as any).pageFollowerCount = post.page.followers.length;

          delete post.page.followers;
        }
        for (const like of post.likes) {
          const likeUserId = like.user.id;

          const bond = await this.bondsRepo.findOne({
            where: [
              { requester: { id: userId }, recipient: { id: likeUserId } },
              { requester: { id: likeUserId }, recipient: { id: userId } },
            ],
          });

          (like as any).isBond = !!bond; // true if bond exists, false otherwise
        }

        // If the post is a poll, include vote statistics
        if (post.type === PostType.POLL && post.poll) {
          const voteCounts = await this.getPollVoteCounts(post.poll);
          const userVote = this.getUserPollVote(post.poll, userId);

          // Only show results if poll is configured to show results or user has voted
          const shouldShowResults =
            post.poll.showResults ||
            (userVote !== null && userVote !== undefined);

          (post as any).pollResults = shouldShowResults ? voteCounts : null;
          (post as any).userVote = userVote;
          (post as any).hasVoted = userVote !== null; // Add hasVoted flag

          // Calculate poll statistics
          if (post.poll.votes && post.poll.votes.length > 0) {
            (post as any).pollStats = {
              totalVotes: post.poll.votes.length,
              hasEnded: post.poll.endDate
                ? new Date() > post.poll.endDate
                : false,
            };
          } else {
            (post as any).pollStats = {
              totalVotes: 0,
              hasEnded: post.poll.endDate
                ? new Date() > post.poll.endDate
                : false,
            };
          }

          // Remove sensitive data if poll is anonymous
          if (post.poll.isAnonymous) {
            delete post.poll.votes;
          }
        }
      }

      res.status(HTTP_STATUS.OK).json(
        handleResponse("Page posts retrieved successfully", {
          page: {
            id: pageEntity.id,
            name: pageEntity.name,
            logoUrl: pageEntity.logoUrl,
          },
          posts,
          pagination: {
            totalItems,
            currentPage: parseInt(page as string, 10),
            pageSize: takeNumber,
            totalPages: Math.ceil(totalItems / takeNumber),
          },
        })
      );
    } catch (error) {
      logger.error(
        `PostController :: getPagePosts :: ${(error as Error)?.message}`
      );
      return next(error);
    }
  }

  async deletePost(
    req: ICustomRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = req.user?.id;
      const postId = req.params.id;

      const post = await this.postRepo.findOne({
        where: { id: postId },
        relations: ["author", "page", "page.admins", "comments", "likes"],
      });

      if (!post) {
        throw new ApiError("Post not found", HTTP_STATUS.NOT_FOUND);
      }

      const isAuthor = post.author.id === userId;
      const isPageAdmin =
        post.isPagePost &&
        post.page &&
        post.page.admins.some((admin) => admin.id === userId);

      if (!isAuthor && !isPageAdmin) {
        throw new ApiError(
          "You are not authorized to delete this post",
          HTTP_STATUS.FORBIDDEN
        );
      }

      if (post.scheduledJobId) {
        try {
          await schedulerService.cancelScheduledPost(post.scheduledJobId);
        } catch (err) {
          logger.warn(`Failed to cancel job: ${post.scheduledJobId}`);
        }
      }
      if (post.comments?.length) {
        await this.commentsRepo.remove(post.comments);
      }

      if (post.likes?.length) {
        await this.likesRepo.remove(post.likes);
      }

      const media =
        post.type !== PostType.POLL && post.media ? (post.media as any) : null;

      if (media) {
        const allMediaUrls = [
          ...(media.IMAGES || []),
          ...(media.VIDEOS || []),
          ...(media.THUMBNAILS || []),
          ...(media.ARTICLES || []),
          ...(media.EVENTS || []),
        ];
        if (allMediaUrls.length > 0) {
          for (const media of allMediaUrls) {
            if (media.public_id) {
              await uploadService.deleteFile(media.public_id);
            }
          }
        }
      }

      await this.postRepo.remove(post);

      res
        .status(HTTP_STATUS.OK)
        .json(handleResponse("Post deleted successfully", null));
    } catch (error) {
      logger.error(
        `PostController :: deletePost :: ${(error as Error).message}`
      );
      return next(error);
    }
  }
}
