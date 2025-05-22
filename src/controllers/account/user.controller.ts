import { NextFunction, Request, RequestHandler, Response } from "express";
import {
  Bond,
  BondStatus,
  COMMENT_VISIBILITY,
  Group,
  Page,
  Poll,
  PollVote,
  Post,
  PostRequestStatus,
  PostStatus,
  PostType,
  PostVisibility,
  ProfileSettings,
  ProfileStatus,
  Saved,
  SavedType,
  User,
} from "../../entity";

import { ApiError } from "../../errors";
import { Brackets, In, Repository } from "typeorm";
import {
  buildFilteredProfile,
  cookieOptions,
  decrypt,
  decryptShareableLink,
  generateShareableLink,
  generateToken,
  handleResponse,
  logger,
  praseMedia,
  verifyToken,
} from "../../utils";
import {
  CHAT_COOKIE,
  CLOUD_FOLDERS,
  HTTP_STATUS,
  POST_STATUS,
} from "../../constants";
import jwt from "jsonwebtoken";
import { Chat, UserForChat } from "../../models";

import bcrypt from "bcryptjs";
import {
  EventDate,
  ICustomRequest,
  IFileObject,
  UploadResult,
} from "../../interfaces";
import { Notification } from "../../models";
import fs from "fs";
import path from "path";
import { commonHelper } from "../../helpers";
import { mailService, uploadService } from "../../services";
import { json } from "stream/consumers";
import { config } from "dotenv";
import { configs } from "../../config";
import * as otplib from "otplib";
import qrCode from "qrcode";

export class UserController {
  constructor(
    private usersRepo: Repository<User>,
    private notificationModel: typeof Notification,
    private postsRepo: Repository<Post>,
    private bondsRepo: Repository<Bond>,
    private savedRepo: Repository<Saved>,
    private pollVoteRepo: Repository<PollVote>,
    private pageRepo: Repository<Page>,
    private groupRepo: Repository<Group>,
    private readonly profileSettingsRepo: Repository<ProfileSettings>,
    private chatModel: typeof Chat
  ) {}

  async verifyTokenAPI(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { token, expiresAt } = req.query;

      if (!token || !expiresAt) {
        throw new ApiError(
          "Token and expiration time are required",
          HTTP_STATUS.BAD_REQUEST
        );
      }

      // Check if the token has expired
      const currentTime = new Date();
      const expirationTime = new Date(expiresAt as string);
      if (currentTime > expirationTime) {
        throw new ApiError("The token has expired", HTTP_STATUS.BAD_REQUEST);
      }

      let payload: {
        userId: string;
        newEmail: string;
      };
      try {
        payload = verifyToken(token as string) as {
          userId: string;
          newEmail: string;
        };
      } catch (error) {
        throw new ApiError(
          "Invalid or tampered token",
          HTTP_STATUS.BAD_REQUEST
        );
      }

      const user = await this.usersRepo.findOne({
        where: { id: payload.userId },
      });
      if (!user) {
        throw new ApiError("User not found", HTTP_STATUS.NOT_FOUND);
      }
      if (user.emailLinkExpire != expiresAt) {
        throw new ApiError(
          "Email Link maybe expired or Invalid",
          HTTP_STATUS.BAD_REQUEST
        );
      }
      user.emailLinkExpire = null;
      user.isEmailVerified = true;
      user.email = payload.newEmail;
      await this.usersRepo.save(user);

      res.status(HTTP_STATUS.OK).json({
        message: "Email has been successfully updated.",
        data: {
          id: user.id,
          email: user.email,
        },
      });
    } catch (error) {
      logger.error(
        `UserController :: verifyTokenAPI :: "${(error as Error)?.message}"`
      );
      return next(error);
    }
  }

  async updateEmail(
    req: ICustomRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      let userId = req.user?.id;
      let { newEmail, oldEmail } = req.body;

      const user = await this.usersRepo
        .createQueryBuilder("user")
        .where("user.id = :userId", { userId })
        .getOne();

      if (!user) {
        throw new ApiError("User not found", HTTP_STATUS.NOT_FOUND);
      }

      if (user.email !== oldEmail) {
        throw new ApiError(
          "The current email does not match the user's email",
          HTTP_STATUS.BAD_REQUEST
        );
      }

      const { token, expiresAt } = generateToken({ userId, newEmail }, "1h");

      const link = `${process.env.FRONTEND_URL}confirm-email?token=${token}&expiresAt=${expiresAt}`;

      await mailService.changeEmailAddress({
        name: user.firstName + " " + user.lastName,
        oldEmail,
        newEmail,
        link,
      });
      // user.email = newEmail;
      // user.isVerified = false;
      user.emailLinkExpire = expiresAt;
      const updatedUser = await this.usersRepo.save(user);

      res.status(HTTP_STATUS.OK).json(
        handleResponse("Email Sent successfully", {
          id: updatedUser.id,
          email: updatedUser.email,
        })
      );
    } catch (error) {
      logger.error(
        `UserController :: updateEmail :: ${(error as Error)?.message}`
      );
      return next(error);
    }
  }

  async changePassword(
    req: ICustomRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = req.user?.id;
      const { oldPassword, newPassword } = req.body;

      const user = await this.usersRepo
        .createQueryBuilder("user")
        .where("user.id = :userId", { userId })
        .getOne();

      if (!user) {
        throw new ApiError("User not found", HTTP_STATUS.NOT_FOUND);
      }

      const isMatch = await bcrypt.compare(oldPassword, user.password);
      if (!isMatch) {
        throw new ApiError("Incorrect old password", HTTP_STATUS.UN_AUTHORIZED);
      }
      if (oldPassword === newPassword) {
        throw new ApiError(
          "New password cannot be the same as old password",
          HTTP_STATUS.BAD_REQUEST
        );
      }

      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(newPassword, salt);

      user.password = hashedPassword;
      await this.usersRepo.save(user);

      res
        .status(HTTP_STATUS.OK)
        .json(handleResponse("Password changed successfully"));
    } catch (error) {
      logger.error(
        `UserController :: changePassword :: ${(error as Error)?.message}`
      );
      return next(error);
    }
  }
  async updateProfileImage(
    req: ICustomRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = req.user?.id;
      const user = await this.usersRepo
        .createQueryBuilder("user")
        .where("user.id = :userId", { userId })
        .getOne();

      if (!user) {
        throw new ApiError("User not found", HTTP_STATUS.NOT_FOUND);
      }

      const imageFilesPath = path.join(process.cwd(), "uploads");

      const imageFiles = fs
        .readdirSync(path.join(imageFilesPath))
        .filter((file) => file.startsWith("image"));

      const imageFileObjects: IFileObject[] = imageFiles.map((file) =>
        commonHelper.createFileObject(path.join(imageFilesPath, file), "image")
      );

      let { country, industry, company, designation, city, about } = req.body;

      const FolderName = `${CLOUD_FOLDERS.USER}/${
        user.firstName.trim() + user.lastName.trim()
      }`;

      const imageUrls = (await uploadService.uploadMultipleFiles(
        imageFileObjects,
        FolderName
      )) as UploadResult[];

      user.profileImage = imageUrls[0]?.url;
      user.imageKey = imageUrls[0]?.public_id;
      user.country = country || user.country;
      user.industry = industry || user.industry;
      user.company = company || user.company;
      user.city = city || user.city;
      user.designation = designation || user.designation;
      user.about = about || user.about;
      user.profileStatus = ProfileStatus.COMPLETED;

      await this.usersRepo.save(user);
      const { password: _, ...userProfile } = user;

      const chatUser = await UserForChat.findById(req.user?._id);
      chatUser.avatar = imageUrls[0]?.url;
      await chatUser.save();
      const uploadsPath = path.join(process.cwd(), "uploads");
      const files = fs.readdirSync(uploadsPath);

      files.forEach((file) => {
        const filePath = path.join(uploadsPath, file);
        fs.unlinkSync(filePath);
      });

      res
        .status(HTTP_STATUS.OK)
        .json(handleResponse("User Profile Updated Successfully", userProfile));
      return next();
    } catch (error) {
      const uploadsPath = path.join(process.cwd(), "uploads");
      const files = fs.readdirSync(uploadsPath);

      files.forEach((file) => {
        const filePath = path.join(uploadsPath, file);
        fs.unlinkSync(filePath);
      });
      logger.error(
        `UserController :: updateProfileImage :: ${(error as Error)?.message}`
      );
      return next(error);
    }
  }

  async updateUser(
    req: ICustomRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = req.user?.id;
      const { about, country, industry, designation, company, city } = req.body;

      // const name = [firstName, lastName].filter(Boolean).join(" ");
      const imageFilesPath = path.join(process.cwd(), "uploads");

      const imageFiles = fs
        .readdirSync(path.join(imageFilesPath))
        .filter((file) => file.startsWith("image")); // Filter for image files

      const coverFiles = fs
        .readdirSync(path.join(imageFilesPath))
        .filter((file) => file.startsWith("cover")); // Filter for image files

      const imageFileObjects: IFileObject[] = imageFiles.map((file) =>
        commonHelper.createFileObject(path.join(imageFilesPath, file), "image")
      );
      const coverFileObjects: IFileObject[] = coverFiles.map((file) =>
        commonHelper.createFileObject(path.join(imageFilesPath, file), "cover")
      );

      // Retrieve user
      const user = await this.usersRepo
        .createQueryBuilder("user")
        .where("user.id = :userId", { userId })
        .getOne();

      if (!user) {
        throw new ApiError("User not found", HTTP_STATUS.NOT_FOUND);
      }

      const FolderName = `${CLOUD_FOLDERS.USER}/${
        user.firstName.trim() + user.lastName.trim()
      }`;
      const imageUrls = (await uploadService.uploadMultipleFiles(
        imageFileObjects,
        FolderName
      )) as UploadResult[];
      const coverUrls = (await uploadService.uploadMultipleFiles(
        coverFileObjects,
        FolderName
      )) as UploadResult[];
      const oldUserImage = user.profileImage;
      if (user.imageKey && imageFileObjects.length > 0) {
        if (imageFileObjects && oldUserImage !== imageUrls[0]?.url) {
          await uploadService.deleteFile(user.imageKey);
        }
      }
      const oldUserCover = user.coverImage;
      if (user.coverImageKey && coverFileObjects.length > 0) {
        if (coverFileObjects && oldUserCover !== coverUrls[0]?.url) {
          await uploadService.deleteFile(user.coverImageKey);
        }
      }
      user.profileImage = imageUrls[0]?.url || user.profileImage;
      user.imageKey = imageUrls[0]?.public_id || user.imageKey;
      user.coverImage = coverUrls[0]?.url || user.coverImage;
      user.coverImageKey = coverUrls[0]?.public_id || user.coverImageKey;

      user.about = about || user.about;

      user.country = country || user.country;
      user.industry = industry || user.industry;
      user.company = company || user.company;
      user.designation = designation || user.designation;
      user.city = city || user.city;

      const updatedUser = await this.usersRepo.save(user);

      const chatUser = await UserForChat.findById(req.user?._id);
      chatUser.avatar = imageUrls[0]?.url;
      await chatUser.save();

      const { password: _, ...userProfile } = updatedUser;

      res
        .status(HTTP_STATUS.OK)
        .json(handleResponse("User profile updated successfully", userProfile));
    } catch (error) {
      const uploadsPath = path.join(process.cwd(), "uploads");

      const files = fs.readdirSync(uploadsPath);

      files.forEach((file) => {
        const filePath = path.join(uploadsPath, file);
        fs.unlinkSync(filePath);
        logger.error(`Deleted file: ${filePath}`);
      });
      logger.error(
        `UserController :: updateUser :: ${(error as Error)?.message}`
      );
      return next(error);
    }
  }

  async verifyNewDevice(
    req: ICustomRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = req.user?.id;

      const user = await this.usersRepo
        .createQueryBuilder("user")
        .where("user.id = :userId", { userId })
        .getOne();

      if (!user) {
        throw new ApiError("User or secret not found", HTTP_STATUS.NOT_FOUND);
      }

      const { token, expiresAt } = generateToken(
        { userId: user.id, newEmail: user.email },
        "1h"
      );

      const resetLink = `${process.env.FRONTEND_URL}google-auth?token=${token}&expiresAt=${expiresAt}`;
      user.passwordResetExpire = expiresAt;
      await this.usersRepo.save(user);

      await mailService.registerNewDevice({
        name: user.firstName + " " + user.lastName,
        email: user.email,
        link: resetLink,
      });

      res.status(HTTP_STATUS.OK).json(
        handleResponse("Email Sent successfully", {
          id: user.id,
          email: user.email,
        })
      );
    } catch (error) {
      logger.error(
        `AuthController :: Register New Device For 2FA :: "${
          (error as Error)?.message
        }"`
      );
      return next(error);
    }
  }

  async getTimeline(
    req: ICustomRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = req.user.id;
      const { page, take, skip } = req?.query;
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

      if (bondedUserIds.length === 0) {
        res.status(200).json({
          status: true,
          data: [],
          message: "No posts found in timeline",
          statusCode: 200,
        });
        return next();
      }

      const [posts, totalItems] = await this.postsRepo
        .createQueryBuilder("post")
        .where("post.status NOT IN (:...excludedStatuses)", {
          excludedStatuses: [
            PostStatus.DRAFT,
            PostStatus.ARCHIVE,
            PostStatus.SCHEDULED,
          ],
        })
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
                    })
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
              );
          })
        )
        .leftJoinAndSelect("post.author", "author")
        .leftJoinAndSelect("author.profileSettings", "profileSettings")
        .leftJoinAndSelect("post.page", "page")
        .leftJoinAndSelect("page.followers", "follower")
        .leftJoinAndSelect("post.likes", "like")
        .leftJoinAndSelect("like.user", "likedUser")
        .leftJoinAndSelect("like.user", "lastLikedUser")
        .leftJoinAndSelect("post.poll", "poll") // Include poll data
        .leftJoinAndSelect("poll.votes", "pollVotes") // Include poll votes
        .leftJoinAndSelect("post.comments", "comment")
        .leftJoinAndSelect("comment.user", "commentUser")
        .leftJoinAndSelect("post.group", "group")
        .leftJoinAndSelect("group.followers", "groupFollower")
        .leftJoinAndSelect("group.admins", "groupAdmin")
        .leftJoinAndSelect("groupAdmin.admin", "adminUser")
        .leftJoinAndSelect("post.groupPostRequests", "request")
        .andWhere("(post.group IS NULL OR request.status = :status)", {
          status: PostRequestStatus.APPROVED,
        })
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
          "comment",
          "commentUser.id",
          "commentUser.firstName",
          "commentUser.lastName",
          "commentUser.profileImage",
          "commentUser.role",
          "commentUser.company",
          "commentUser.designation",
          "commentUser.industry",
          "poll", // Include poll fields
          "pollVotes.id",
          "pollVotes.optionIndex",
          "pollVotes.userId",
          "pollVotes.createdAt",
          "page",
          "follower",
          "group",
          "groupFollower",
          "groupAdmin",
          "adminUser",
          "profileSettings",
        ])
        .orderBy("post.createdAt", "DESC")
        .addOrderBy("like.createdAt", "DESC")
        .skip(skipNumber)
        .take(takeNumber)
        .getManyAndCount();

      const savedPosts = await this.savedRepo.find({
        where: { user: { id: userId } },
        relations: ["post"],
      });

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

        if (post.author.profileSettings) {
          const user = post.author;
          const settings = user.profileSettings;
          let about = user.about as any;

          const filteredProfile: any = buildFilteredProfile(
            user,
            about,
            settings
          );
          (post as any).author = filteredProfile;
        }

        (post as any).canComment = canComment;

        ((post as any).shareableLink = generateShareableLink({
          id: post.id,
          type: "post",
          typeName: post.type,
        })),
          ((post as any).likesCount = post.likes.length);
        const lastLike = post.likes[0];
        (post as any).lastLikedUser = lastLike
          ? `${lastLike.user.firstName} ${lastLike.user.lastName}`
          : null;
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
        (post as any).isSaved = savedPosts.some(
          (savedPost) =>
            savedPost.type === SavedType.POST && savedPost.post.id === post.id
        );

        if (post.isPagePost) {
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

          (post as any).groupFollowerCount = post.group.followers.length;
          (post as any).isAdmin = post.group.admins.some(
            (admin) => admin.admin.id === userId
          );
          (post as any).isCreator = post.group.creatorId === userId;
          delete post.group.followers;
        }

        const bond = await this.bondsRepo.findOne({
          where: [
            { requester: { id: userId }, recipient: { id: post.author.id } },
            { requester: { id: post.author.id }, recipient: { id: userId } },
          ],
        });
        (post as any).isBond = !!bond;

        (post as any).commentsCount = post.comments.length;

        // If the post is a poll, include vote statistics
        if (post.type === PostType.POLL && post.poll) {
          const voteCounts = await this.getPollVoteCounts(post.poll);
          const userVotes = this.getUserPollVotes(post.poll, userId);
          const hasVoted = userVotes.length > 0;

          // Determine if results should be shown
          const hasEnded = post.poll.endDate
            ? new Date() > post.poll.endDate
            : false;
          const shouldShowResults =
            post.poll.showResults || hasVoted || hasEnded;

          (post as any).pollResults = shouldShowResults ? voteCounts : null;
          (post as any).userVote =
            userVotes.length > 0 ? userVotes[userVotes.length - 1] : null;
          (post as any).userVotes = post.poll.allowMultipleVotes
            ? userVotes
            : undefined;
          (post as any).hasVoted = hasVoted;

          // Calculate poll statistics
          (post as any).pollStats = {
            totalVotes: post.poll.votes?.length || 0,
            hasEnded: hasEnded,
          };

          // Remove sensitive data if poll is anonymous
          if (post.poll.isAnonymous) {
            delete post.poll.votes;
          }
        }
      }

      res.status(200).json(
        handleResponse("Timeline Fetched Successfully", {
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
        `UserController :: getTimeline :: ${(error as Error)?.message}`
      );
      next(error);
    }
  }

  private getUserPollVotes(poll: Poll, userId: string): number[] {
    if (!poll || !poll.votes || !userId) {
      return [];
    }

    const userVotes = poll.votes.filter((vote) => vote.userId === userId);

    return userVotes.map((vote) => vote.optionIndex);
  }

  private async getPollVoteCounts(poll: Poll): Promise<any[]> {
    if (!poll || !poll.options) {
      return [];
    }

    const votes = await this.pollVoteRepo.find({
      where: { pollId: poll.id },
      relations: ["user"],
    });

    const totalVotes = votes.length;

    const voteCounts = poll.options.map((option, index) => {
      const optionVotes = votes.filter(
        (vote: { optionIndex: number }) => vote.optionIndex === index
      );

      const voteDetails = poll.isAnonymous
        ? []
        : optionVotes.map(
            (vote: {
              userId: any;
              user: {
                firstName: any;
                lastName: any;
                profileImage: any;
                company: any;
                designation: any;
              };
            }) => ({
              userId: vote.userId,
              firstName: vote.user.firstName,
              lastName: vote.user.lastName,
              profileImage: vote.user.profileImage,
              company: vote.user.company,
              designation: vote.user.designation,
            })
          );

      return {
        option,
        optionIndex: index,
        count: optionVotes.length,
        percentage:
          totalVotes > 0
            ? Math.round((optionVotes.length / totalVotes) * 100)
            : 0,
        voters: voteDetails,
      };
    });

    return voteCounts;
  }

  async fetchNotifications(
    req: ICustomRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = req.user?._id;

      const { page = 1, pageSize = 10 } = req.query;

      const pageNumber = parseInt(page as string, 10);
      const pageLimit = parseInt(pageSize as string, 10);

      const [notifications, totalItems] = await Promise.all([
        this.notificationModel
          .find({ user: userId })
          .sort({ createdAt: -1 })
          .skip((pageNumber - 1) * pageLimit)
          .limit(pageLimit)
          .lean(),
        this.notificationModel.countDocuments({ user: userId }),
      ]);

      const totalPages = Math.ceil(totalItems / pageLimit);

      res.status(HTTP_STATUS.OK).json(
        handleResponse("Notifications fetched successfully", {
          notifications,
          pagination: {
            totalItems,
            currentPage: pageNumber,
            pageSize: pageLimit,
            totalPages,
          },
        })
      );
    } catch (error) {
      logger.error(
        `UserController :: fetchNotifications :: ${(error as Error)?.message}`
      );
      return next(error);
    }
  }

  async getUserProfile(
    req: ICustomRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = req.user?.id;
      const user = (await this.usersRepo
        .createQueryBuilder("user")
        .where("user.id = :userId", { userId })
        .leftJoinAndSelect("user.profileSettings", "profileSettings")
        .getOne()) as User;
      if (!user) {
        throw new ApiError("User profile not found", HTTP_STATUS.NOT_FOUND);
      }
      if (!user.profileSettings) {
        const newSettings = this.profileSettingsRepo.create({
          user: user,
        });
        user.profileSettings = await this.profileSettingsRepo.save(newSettings);
      }

      let { password: _, ...userProfile } = user as User & {
        bondCount?: number;
        groupCount?: number;
        pageCount?: number;
        postCount?: number;
        followedGroupCount?: number;
        followedPageCount?: number;
      };
      const [
        count,
        groupCount,
        pageCount,
        postCount,
        followedGroupCount,
        followedPageCount,
      ] = await Promise.all([
        this.bondsRepo
          .createQueryBuilder("bond")
          .where("(bond.requesterId = :userId OR bond.recipientId = :userId)", {
            userId,
          })
          .andWhere("bond.status = :status", { status: BondStatus.ACCEPTED })
          .getCount(),
        this.groupRepo
          .createQueryBuilder("group")
          .where("group.creatorId = :userId", { userId })
          .getCount(),

        this.pageRepo
          .createQueryBuilder("page")
          .where("page.creatorId = :userId", { userId })
          .getCount(),

        this.postsRepo
          .createQueryBuilder("post")
          .where("post.authorId = :userId", { userId })
          .getCount(),
        //get the count of groups which user is follower
        this.groupRepo
          .createQueryBuilder("group")
          .leftJoinAndSelect("group.followers", "follower")
          .where("follower.id = :userId", { userId })
          .getCount(),
        //get the count of pages which user is follower
        this.pageRepo
          .createQueryBuilder("page")
          .leftJoinAndSelect("page.followers", "follower")
          .where("follower.id = :userId", { userId })
          .getCount(),
      ]);

      const bondCount = count || 0;
      userProfile.bondCount = bondCount;
      userProfile.groupCount = groupCount || 0;
      userProfile.pageCount = pageCount || 0;
      userProfile.postCount = postCount || 0;
      userProfile.followedGroupCount = followedGroupCount || 0;
      userProfile.followedPageCount = followedPageCount || 0;
      res
        .status(HTTP_STATUS.OK)
        .json(
          handleResponse("User profile retrieved successfully", userProfile)
        );
    } catch (error) {
      logger.error(
        `UserController :: getUserProfile :: ${(error as Error)?.message}`
      );
      return next(error);
    }
  }

  async verifyResync(
    req: ICustomRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { firstToken, secondToken } = req.body;
      const userId = req.user?.id;

      const user = await this.usersRepo
        .createQueryBuilder("user")
        .where("user.id = :userId", { userId })
        .getOne();

      if (!user || !user.secret) {
        throw new ApiError("User or secret not found", HTTP_STATUS.NOT_FOUND);
      }
      otplib.authenticator.options = { window: 1 };

      const isFirstValid = otplib.authenticator.check(firstToken, user.secret);

      const nextToken = otplib.authenticator.generate(user.secret);
      const isSecondValid = secondToken === nextToken;

      const token = jwt.sign(
        {
          id: user.id,
          email: user.email,
          role: user.role,
          _id: user.userChatId,
        },
        process.env.JWT_SECRET!,
        { expiresIn: "24h" }
      );
      const { password: _, ...userWithoutPassword } = user;

      if (isFirstValid && isSecondValid) {
        res.status(HTTP_STATUS.OK).json(
          handleResponse("2FA resynchronized successfully", {
            token,
            user: userWithoutPassword,
          })
        );
      } else {
        throw new ApiError(
          "Failed to resynchronize 2FA",
          HTTP_STATUS.BAD_REQUEST
        );
      }
    } catch (error) {
      logger.error(
        `UserController :: verifyResync :: ${(error as Error)?.message}`
      );
      return next(error);
    }
  }

  async verifyQr(
    req: ICustomRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = req.user?.id;
      const user = await this.usersRepo
        .createQueryBuilder("user")
        .where("user.id = :userId", { userId })
        .getOne();
      if (!user) {
        throw new ApiError("User not found", HTTP_STATUS.NOT_FOUND);
      }
      if (!user.secret) {
        throw new ApiError(
          "Register to a Authenticator First",
          HTTP_STATUS.BAD_REQUEST
        );
      }

      const isValid = otplib.authenticator.check(req.body.token, user.secret);
      if (!isValid) {
        throw new ApiError("Invalid token", HTTP_STATUS.BAD_REQUEST);
      }
      if (!user.is2FAEnabled) {
        user.is2FAEnabled = true;
        await this.usersRepo.save(user);
        const token = jwt.sign(
          {
            id: user.id,
            email: user.email,
            role: user.role,
            _id: user.userChatId,
          },
          process.env.JWT_SECRET!,
          { expiresIn: "24h" }
        );
        const { password: _, ...userWithoutPassword } = user;

        res.status(HTTP_STATUS.OK).json(
          handleResponse("Login successful", {
            token,
            user: userWithoutPassword,
          })
        );
      } else {
        const token = jwt.sign(
          {
            id: user.id,
            email: user.email,
            role: user.role,
            _id: user.userChatId,
          },
          process.env.JWT_SECRET!,
          { expiresIn: "24h" }
        );
        const { password: _, ...userWithoutPassword } = user;

        res.status(HTTP_STATUS.OK).json(
          handleResponse("Login successful", {
            token,
            user: userWithoutPassword,
          })
        );
        return next();
      }
    } catch (error) {
      logger.error(
        `UserController :: verifyQr :: ${(error as Error)?.message}`
      );
      return next(error);
    }
  }

  async generateQr(
    req: ICustomRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = req.user?.id;
      const user = await this.usersRepo
        .createQueryBuilder("user")
        .where("user.id = :userId", { userId })
        .getOne();
      if (!user) {
        throw new ApiError("User not found", HTTP_STATUS.NOT_FOUND);
      }
      if (user.secret && user.is2FAEnabled) {
        throw new ApiError("2FA is already enabled", HTTP_STATUS.BAD_REQUEST);
      }

      const secret = otplib.authenticator.generateSecret();
      const otpauthUrl = otplib.authenticator.keyuri(
        user.email,
        configs.QR_ISSUER,
        secret
      );
      user.secret = secret;
      await this.usersRepo.save(user);

      const qrcode = await qrCode.toDataURL(otpauthUrl);
      const QrToken = jwt.sign(
        {
          id: user.id,
          email: user.email,
          role: user.role,
          _id: user.userChatId,
        },
        process.env.JWT_QR_SECRET!,
        { expiresIn: "24h" }
      );
      const { password: _, ...userWithoutPassword } = user;

      res.status(HTTP_STATUS.OK).json(
        handleResponse("QR Code generated successfully", {
          qrcode,
          secret,
          token: QrToken,
          user: userWithoutPassword,
        })
      );
    } catch (error) {
      logger.error(
        `UserController :: generateQr :: ${(error as Error)?.message}`
      );
      return next(error);
    }
  }

  async getSharedEntity(
    req: ICustomRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { data } = req.params;
      const userId = req.user?.id;
      const entities = decryptShareableLink(data as string);
      const { id, type } = entities[0];

      let entity;
      if (type === "user") {
        const userId = id;
        const user = (await this.usersRepo
          .createQueryBuilder("user")
          .where("user.id = :userId", { userId })
          .getOne()) as User;
        if (!user) {
          throw new ApiError("User profile not found", HTTP_STATUS.NOT_FOUND);
        }
        if (!user.profile) {
          throw new ApiError(
            "User profile is not Public",
            HTTP_STATUS.NOT_FOUND
          );
        }
      } else if (type === "post") {
        const singlePost = await this.postsRepo
          .createQueryBuilder("post")
          .where("post.id = :id", { id })
          .leftJoinAndSelect("post.author", "author")
          .leftJoinAndSelect("post.likes", "like")
          .leftJoinAndSelect("like.user", "likeUser")
          .leftJoinAndSelect("like.user", "lastLikedUser")
          .leftJoinAndSelect("post.poll", "poll") // Include poll data
          .leftJoinAndSelect("poll.votes", "pollVotes") // Include poll votes
          .leftJoinAndSelect("post.comments", "comment")
          .leftJoinAndSelect("post.group", "group")
          .leftJoinAndSelect("group.followers", "groupFollower")
          .leftJoinAndSelect("post.page", "page")
          .leftJoinAndSelect("page.followers", "follower")
          .leftJoinAndSelect("group.admins", "groupAdmin")
          .leftJoinAndSelect("groupAdmin.admin", "adminUser")
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
            "groupAdmin",
            "adminUser",
          ])
          .addOrderBy("like.createdAt", "DESC")
          .getOne();

        if (!singlePost) {
          res.status(200).json(handleResponse("Post not found"));
          return next();
        }

        praseMedia(singlePost);
        (singlePost as any).likesCount = singlePost.likes.length;
        (singlePost as any).commentsCount = singlePost.comments.length;
        //remove the comments from post
        delete singlePost.comments;
        const lastLike = singlePost.likes[0];
        (singlePost as any).lastLikedUser = lastLike
          ? `${lastLike.user.firstName} ${lastLike.user.lastName}`
          : null;

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
          (singlePost as any).isAdmin = singlePost.group.admins.some(
            (admin) => admin.admin.id === userId
          );
          (singlePost as any).isCreator = singlePost.group.creatorId === userId;
          delete singlePost.group.followers;
        }

        // If the post is a poll, include vote statistics
        if (singlePost.type === PostType.POLL && singlePost.poll) {
          const voteCounts = await this.getPollVoteCounts(singlePost.poll);
          const userVote = this.getUserPollVote(
            singlePost.poll,
            userId as string
          );

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

          if (userId) {
            (like as any).isBond = !!bond;
          } else {
            (like as any).isBond = false;
          }
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
      } else if (type === "page") {
        const page = await this.pageRepo
          .createQueryBuilder("page")
          .leftJoinAndSelect("page.creator", "creator")
          .leftJoinAndSelect("page.admins", "admin")
          .leftJoinAndSelect("page.followers", "follower")
          .where("page.id = :id", { id })
          .getOne();

        if (!page) {
          throw new ApiError("Page not found", HTTP_STATUS.NOT_FOUND);
        }

        (page as any).shareableLink = generateShareableLink({
          id: page.id,
          type: "page",
          typeName: page.type,
        });
        // Check if current user is following
        const userId = req.user?.id;
        const isFollowing = page.followers.some(
          (follower) => follower.id === userId
        );
        const isAdmin = page.admins.some((admin) => admin.id === userId);

        // Add additional fields
        const responseData = {
          ...page,
          isFollowing,
          isAdmin,
          followerCount: page.followers.length,
        };

        res
          .status(HTTP_STATUS.OK)
          .json(handleResponse("Page retrieved successfully", responseData));
        return next();
      }

      if (!entity) {
        throw new ApiError("Entity not found", HTTP_STATUS.NOT_FOUND);
      }
      res
        .status(200)
        .json(handleResponse("Entity Fetched Successfully", entity));
      return next();
    } catch (error) {
      logger.error(
        `GeneralController :: Get Shared Entity :: ${(error as Error)?.message}`
      );
      return next(error);
    }
  }

  private getUserPollVote(poll: Poll, userId: string): number | null {
    if (!poll || !poll.votes || !userId) {
      return null;
    }

    // Find the user's vote
    const userVote = poll.votes.find((vote) => vote.userId === userId);

    // Return the option index if found, otherwise null
    return userVote ? userVote.optionIndex : null;
  }

  async updateProfileSettings(
    req: ICustomRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = req.user?.id;
      const profileFields = [
        "profileViewingOption",
        "showProfilePhoto",
        "pageVisitVisibility",
        "allowPublicProfileEdit",
        "showEmail",
        "showConnections",
        "showFollowedMembers",
        "showLastName",
        "showOrganizationsAndInterests",
        "allowPageOwnersToExportData",
        "discoverableOutsideLinkedIn",
        "discoverableByEmail",
        "discoverableByPhone",
        "showHeadline",
        "showSummary",
        "showArticlesAndActivity",
        "showCurrentExperience",
        "showCurrentExperienceDetails",
        "showPastExperience",
        "showPastExperienceDetails",
        "showEducation",
        "showEducationDetails",
        "showCertifications",
        "showProjects",
        "showLanguages",
      ];

      const user = await this.usersRepo
        .createQueryBuilder("user")
        .where("user.id = :userId", { userId })
        .leftJoinAndSelect("user.profileSettings", "profileSettings")
        .getOne();

      if (!user) {
        throw new ApiError("User not found", HTTP_STATUS.NOT_FOUND);
      }

      if (!user.profileSettings) {
        const newProfileSettings = new ProfileSettings();
        newProfileSettings.user = user;
        user.profileSettings = newProfileSettings;
      }

      for (const field of profileFields) {
        if (field in req.body) {
          (user.profileSettings as any)[field] = req.body[field];
        }
      }

      const updatedUser = await this.usersRepo.save(user);
      delete updatedUser.profileSettings.user;

      res.status(HTTP_STATUS.OK).json({
        message: "User profile settings updated successfully",
        data: updatedUser,
      });
      return next();
    } catch (error) {
      logger.error(
        `UserController :: updateProfileSettings :: ${
          (error as Error)?.message
        }`
      );
      return next(error);
    }
  }

  async getPublicUserProfile(
    req: ICustomRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const bond = req.query.bond;
      if (bond) {
        try {
          const loggedInUserId = req.user.id;
          const targetUserId = req.query.userId as string;

          if (!targetUserId) {
            throw new ApiError(
              "Target userId is required",
              HTTP_STATUS.BAD_REQUEST
            );
          }
          const targetUser = await this.usersRepo
            .createQueryBuilder("user")
            .leftJoinAndSelect("user.profileSettings", "profileSettings")
            .where("user.id = :userId", { userId: targetUserId })
            .getOne();

          if (!targetUser) {
            throw new ApiError("User profile not found", HTTP_STATUS.NOT_FOUND);
          }
          if (!targetUser.profileSettings.showConnections) {
            throw new ApiError(
              "User profile is not Public",
              HTTP_STATUS.NOT_FOUND
            );
          }

          // Step 1: Get all accepted bonds of the target user
          const bonds = await this.bondsRepo.find({
            where: [
              { requester: { id: targetUserId }, status: BondStatus.ACCEPTED },
              { recipient: { id: targetUserId }, status: BondStatus.ACCEPTED },
            ],
            relations: ["requester", "recipient"],
          });

          // Step 2: Get mutual bond information by checking for a bond with the logged-in user
          const mutualBonds = await this.bondsRepo.find({
            where: [
              {
                requester: { id: loggedInUserId },
                status: In([BondStatus.ACCEPTED, BondStatus.PENDING]),
              },
              {
                recipient: { id: loggedInUserId },
                status: In([BondStatus.ACCEPTED, BondStatus.PENDING]),
              },
            ],
            relations: ["requester", "recipient"],
          });

          const acceptedMutualMap: Record<string, string> = {};
          const pendingMutualMap: Record<string, string> = {};

          for (const bond of mutualBonds) {
            const otherUserId =
              bond.requester.id === loggedInUserId
                ? bond.recipient.id
                : bond.requester.id;

            if (bond.status === BondStatus.ACCEPTED) {
              acceptedMutualMap[otherUserId] = bond.id;
            } else if (bond.status === BondStatus.PENDING) {
              pendingMutualMap[otherUserId] = bond.id;
            }
          }

          const formattedBonds = bonds.map((bond) => {
            const otherUser =
              bond.requester.id === targetUserId
                ? bond.recipient
                : bond.requester;
            const otherUserId = otherUser.id;

            return {
              // bondId: bond.id,
              // status: bond.status,
              mutualBondId: acceptedMutualMap[otherUserId] || null,
              pendingBondId: pendingMutualMap[otherUserId] || null,
              isPending: !!pendingMutualMap[otherUserId],
              isMutual: !!acceptedMutualMap[otherUserId],
              otherUser: {
                id: otherUser.id,
                firstName: otherUser.firstName,
                lastName: otherUser.lastName,
                bio: otherUser.about,
                email: otherUser.email,
                profileImage: otherUser.profileImage,
                coverImage: otherUser.coverImage,
                designation: otherUser.designation,
                city: otherUser.city,
                country: otherUser.country,
                industry: otherUser.industry,
              },
            };
          });

          res
            .status(HTTP_STATUS.OK)
            .json(
              handleResponse("User bonds fetched successfully ", formattedBonds)
            );
          return next();
        } catch (error) {
          logger.error(
            `UserController :: getPublicUserBonds :: ${
              (error as Error).message
            }`
          );
          return next(error);
        }
      }

      const userId = req.query.userId as string;

      const user = await this.usersRepo
        .createQueryBuilder("user")
        .leftJoinAndSelect("user.profileSettings", "profileSettings")
        .where("user.id = :userId", { userId })
        .getOne();

      if (!user) {
        throw new ApiError("User profile not found", HTTP_STATUS.NOT_FOUND);
      }

      const [
        count,
        groupCount,
        pageCount,
        postCount,
        followedGroupCount,
        followedPageCount,
      ] = await Promise.all([
        this.bondsRepo
          .createQueryBuilder("bond")
          .where("(bond.requesterId = :userId OR bond.recipientId = :userId)", {
            userId,
          })
          .andWhere("bond.status = :status", { status: BondStatus.ACCEPTED })
          .getCount(),
        this.groupRepo
          .createQueryBuilder("group")
          .where("group.creatorId = :userId", { userId })
          .getCount(),

        this.pageRepo
          .createQueryBuilder("page")
          .where("page.creatorId = :userId", { userId })
          .getCount(),

        this.postsRepo
          .createQueryBuilder("post")
          .where("post.authorId = :userId", { userId })
          .getCount(),
        //get the count of groups which user is follower
        this.groupRepo
          .createQueryBuilder("group")
          .leftJoinAndSelect("group.followers", "follower")
          .where("follower.id = :userId", { userId })
          .getCount(),
        //get the count of pages which user is follower
        this.pageRepo
          .createQueryBuilder("page")
          .leftJoinAndSelect("page.followers", "follower")
          .where("follower.id = :userId", { userId })
          .getCount(),
      ]);

      const settings = user.profileSettings;
      let about = user.about as any;

      const filteredProfile: any = this.buildFilteredProfile(
        user,
        about,
        settings,
        count,
        groupCount,
        pageCount,
        postCount,
        followedGroupCount,
        followedPageCount
      );
      res
        .status(HTTP_STATUS.OK)
        .json(
          handleResponse("User profile retrieved successfully", filteredProfile)
        );
    } catch (error) {
      logger.error(
        `UserController :: getUserProfile :: ${(error as Error)?.message}`
      );
      return next(error);
    }
  }

  private buildFilteredProfile(
    user: any,
    about: any,
    settings: any,
    count: number,
    groupCount: number,
    pageCount: number,
    postCount: number,
    followedGroupCount: number,
    followedPageCount: number
  ) {
    // 1️⃣ Normalize all possible arrays up front
    const exps = Array.isArray(about?.experience) ? about.experience : [];
    const edus = Array.isArray(about?.education) ? about.education : [];
    const certs = Array.isArray(about?.certifications)
      ? about.certifications
      : [];
    const projects = Array.isArray(about?.projects) ? about.projects : [];
    const langs = Array.isArray(about?.languages) ? about.languages : [];
    const skills = Array.isArray(about?.skills) ? about.skills : [];

    // 2️⃣ Build your profile object
    const filteredProfile: any = {
      bondCount: count,
      yourGroupCount: groupCount,
      yourPageCount: pageCount,
      yourPostCount: postCount,
      followedGroupCount: followedGroupCount,
      followedPageCount: followedPageCount,
      firstName: user.firstName,
      phoneNumber: user.phoneNumber,
      showConnections: settings.showConnections,
      //split the lkastnaem and use first alphabet only
      lastName: user.lastName
        ? settings.showLastName
          ? // Full, capitalized
            user.lastName.charAt(0).toUpperCase() + user.lastName.slice(1)
          : // Only initial, capitalized
            user.lastName.charAt(0).toUpperCase() + "."
        : "",
      ...(settings?.showEmail && { email: user.email }),
      ...(settings?.showProfilePhoto && {
        profileImage: user.profileImage,
        coverImage: user.coverImage,
      }),
      ...(settings?.showHeadline && { designation: user.designation }),
      ...(settings?.showOrganizationsAndInterests && {
        company: user.company,
        industry: user.industry,
      }),
      city: user.city,
      country: user.country,
      about: {
        ...(settings?.showSummary && { bio: about?.bio }),

        // Current experience (always safe even if exps is empty)
        ...(settings?.showCurrentExperience && {
          currentExperience: exps
            .filter((exp: { currently: any }) => exp.currently)
            .map((exp: { title: any }) =>
              settings?.showCurrentExperienceDetails
                ? exp
                : { title: exp.title }
            ),
        }),

        // Past experience (safe on empty too)
        ...(settings?.showPastExperience && {
          pastExperience: exps
            .filter((exp: { currently: any }) => !exp.currently)
            .map((exp: { title: any }) =>
              settings?.showPastExperienceDetails ? exp : { title: exp.title }
            ),
        }),

        // Education
        ...(settings?.showEducation && {
          education: edus.map((edu: { school: any }) =>
            settings?.showEducationDetails ? edu : { school: edu.school }
          ),
        }),

        // Certifications
        ...(settings?.showCertifications && { certifications: certs }),

        // Projects
        ...(settings?.showProjects && { projects: projects }),

        // Languages
        ...(settings?.showLanguages && { languages: langs }),

        // Skills
        ...(settings?.showSkills && { skills: skills }),

        ...(settings?.pageVisitVisibility && {}),
      },
    };

    return filteredProfile;
  }

  async getPublicUserBonds(
    req: ICustomRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const loggedInUserId = req.user.id;
      const targetUserId = req.query.userId as string;

      if (!targetUserId) {
        throw new ApiError(
          "Target userId is required",
          HTTP_STATUS.BAD_REQUEST
        );
      }

      const bonds = await this.bondsRepo.find({
        where: [
          { requester: { id: targetUserId } },
          { recipient: { id: targetUserId } },
        ],
        relations: ["requester", "recipient"],
      });

      const mutualBonds: any[] = [];
      const otherBonds: any[] = [];

      bonds.forEach((bond) => {
        const otherUser =
          bond.requester.id === targetUserId ? bond.recipient : bond.requester;

        const isMutual =
          (bond.requester.id === targetUserId &&
            bond.recipient.id === loggedInUserId) ||
          (bond.recipient.id === targetUserId &&
            bond.requester.id === loggedInUserId);

        const formattedBond = {
          bondId: bond.id,
          status: bond.status,
          isMutual,
          isSentByUser: bond.requester.id === targetUserId,
          otherUser: {
            id: otherUser.id,
            firstName: otherUser.firstName,
            lastName: otherUser.lastName,
            email: otherUser.email,
            profileImage: otherUser.profileImage,
            coverImage: otherUser.coverImage,
            designation: otherUser.designation,
          },
        };

        if (isMutual) {
          mutualBonds.push(formattedBond);
        } else {
          otherBonds.push(formattedBond);
        }
      });

      res.status(HTTP_STATUS.OK).json(
        handleResponse("User bonds fetched successfully 💫", {
          mutualBonds,
          otherBonds,
        })
      );
    } catch (error) {
      logger.error(
        `UserController :: getPublicUserBonds :: ${(error as Error).message}`
      );
      return next(error);
    }
  }

  async savePost(
    req: ICustomRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { postId } = req.params;
      const { type } = req.body as { type: SavedType };
      const userId = req.user?.id;

      if (!postId || !type) {
        res.status(400).json(handleResponse("Post ID and type are required"));
        return next();
      }

      const post = await this.postsRepo.findOne({ where: { id: postId } });
      if (!post) {
        res.status(404).json(handleResponse("Post not found"));
        return next();
      }

      const existingSave = await this.savedRepo.findOne({
        where: { user: { id: userId }, post: { id: postId } },
      });
      if (existingSave) {
        await this.savedRepo.delete(existingSave.id);
        res.status(200).json(handleResponse("Post unsaved successfully"));
        return next();
      }

      const savedPost = this.savedRepo.create({
        user: { id: userId },
        post: { id: postId },
        type,
      });

      await this.savedRepo.save(savedPost);

      res
        .status(200)
        .json(handleResponse("Post saved successfully", savedPost));
      return next();
    } catch (error) {
      next(error);
    }
  }

  async getSavedPosts(
    req: ICustomRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = req.user?.id;
      const { page, take, skip } = req.query;
      const skipNumber = Number(skip) || 0;
      const takeNumber = Number(take) || 10;

      if (!userId) {
        res.status(400).json(handleResponse("User not authenticated"));
        return next();
      }

      // 1. Fetch saved posts with relations
      const savedPosts = await this.savedRepo.find({
        where: { user: { id: userId } },
        relations: [
          "post",
          "post.comments",
          "post.likes",
          "post.likes.user",
          "post.author",
          "post.author.profileSettings",
          "post.poll",
          "post.poll.votes",
          "post.page",
          "post.page.followers",
          "post.group",
          "post.group.followers",
          "post.group.admins",
          "post.group.admins.admin",
        ],
        order: { createdAt: "DESC" },
        skip: skipNumber,
        take: takeNumber,
      });
      const totalItems = await this.savedRepo.count({
        where: { user: { id: userId } },
      });

      // 2. Process each post the same way you process in your for loop
      for (const saved of savedPosts) {
        const post = saved.post;

        praseMedia(post);
          if (post.author.profileSettings) {
          const user = post.author;
          const settings = user.profileSettings;
          let about = user.about as any;

          const filteredProfile: any = buildFilteredProfile(
            user,
            about,
            settings
          );
          (post as any).author = filteredProfile;
        }

        (post as any).shareableLink = generateShareableLink({
          id: post.id,
          type: "post",
          typeName: post.type,
        });

        (post as any).commentsCount = post.comments?.length || 0;
        (post as any).likesCount = post.likes?.length || 0;

        const lastLike = post.likes?.[0];
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

          (post as any).groupFollowerCount = post.group.followers.length;
          (post as any).isAdmin = post.group.admins.some(
            (admin) => admin.admin.id === userId
          );
          (post as any).isCreator = post.group.creatorId === userId;
          delete post.group.followers;
        }
        // Loop over likes to check bonds
        for (const like of post.likes || []) {
          const likeUserId = like.user.id;

          const bond = await this.bondsRepo.findOne({
            where: [
              { requester: { id: userId }, recipient: { id: likeUserId } },
              { requester: { id: likeUserId }, recipient: { id: userId } },
            ],
          });

          (like as any).isBond = !!bond;
        }

        if (post.type === PostType.POLL && post.poll) {
          const voteCounts = await this.getPollVoteCounts(post.poll);
          const userVote = this.getUserPollVote(post.poll, userId);

          const shouldShowResults =
            post.poll.showResults ||
            (userVote !== null && userVote !== undefined);

          (post as any).pollResults = shouldShowResults ? voteCounts : null;
          (post as any).userVote = userVote;
          (post as any).hasVoted = userVote !== null;

          // Poll stats
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

          if (post.poll.isAnonymous) {
            delete post.poll.votes;
          }
        }
      }

      res.status(200).json(
        handleResponse("Saved posts retrieved successfully", {
          savedPosts,

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
      next(error);
    }
  }

  async getAllPostOfUser(
    req: ICustomRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { id } = req.params;
      const { page, take, skip, profileId } = req?.query;
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
        const singlePost = await this.postsRepo
          .createQueryBuilder("post")
          .where("post.id = :id", { id })
          .andWhere("post.author = :profileId", { profileId })
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
          .leftJoinAndSelect("author.profileSettings", "profileSettings")
          .leftJoinAndSelect("post.likes", "like")
          .leftJoinAndSelect("like.user", "likeUser")
          .leftJoinAndSelect("like.user", "lastLikedUser")
          .leftJoinAndSelect("post.poll", "poll") // Include poll data
          .leftJoinAndSelect("poll.votes", "pollVotes") // Include poll votes
          .leftJoinAndSelect("post.comments", "comment")
          .leftJoinAndSelect("post.page", "page")
          .leftJoinAndSelect("comment.user", "commentUser")
          .leftJoinAndSelect("page.followers", "follower")
          .leftJoinAndSelect("post.group", "group")
          .leftJoinAndSelect("group.followers", "groupFollower")
          .leftJoinAndSelect("group.admins", "groupAdmin")
          .leftJoinAndSelect("groupAdmin.admin", "adminUser")
          .leftJoinAndSelect("post.groupPostRequests", "request")
          .andWhere("(post.group IS NULL OR request.status = :status)", {
            status: PostRequestStatus.APPROVED,
          })

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
            "groupAdmin",
            "adminUser",
            "profileSettings",
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

        if (singlePost.author.profileSettings) {
          const user = singlePost.author;
          const settings = user.profileSettings;
          let about = user.about as any;

          const filteredProfile: any = buildFilteredProfile(
            user,
            about,
            settings
          );
          (singlePost as any).author = filteredProfile;
        }
        praseMedia(singlePost);
        (singlePost as any).likesCount = singlePost.likes.length;
        (singlePost as any).commentsCount = singlePost.comments.length;
        //remove the comments from post
        delete singlePost.comments;
        const isSaved = await this.savedRepo.find({
          where: { user: { id: userId }, post: { id } },
        });
        if (isSaved.length > 0) {
          (singlePost as any).isSaved = true;
        } else {
          (singlePost as any).isSaved = false;
        }
        const lastLike = singlePost.likes[0];
        (singlePost as any).lastLikedUser = lastLike
          ? `${lastLike.user.firstName} ${lastLike.user.lastName}`
          : null;

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

        // If the post is a poll, include vote statistics
        if (singlePost.type === PostType.POLL && singlePost.poll) {
          const voteCounts = await this.getPollVoteCounts(singlePost.poll);
          const userVote = this.getUserPollVote(
            singlePost.poll,
            userId as string
          );

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
              {
                requester: { id: userId as string },
                recipient: { id: likeUserId },
              },
              {
                requester: { id: likeUserId },
                recipient: { id: userId as string },
              },
            ],
          });

          (like as any).isBond = !!bond; // true if bond exists, false otherwise
        }
        if (singlePost.group) {
          const isFollowing = singlePost.group.followers.some(
            (follower) => follower.id === userId
          );
          (singlePost as any).isAdmin = singlePost.group?.admins.some(
            (groupAdmin) => groupAdmin.admin.id === userId
          );
          (singlePost as any).isCreator =
            singlePost.group?.creatorId === userId;
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
        const [posts, totalItems] = await this.postsRepo
          .createQueryBuilder("post")
          .where("post.author = :userId", { userId: profileId })
          .andWhere("post.status= :status", { status: PostStatus.PUBLISH })
          .leftJoinAndSelect("post.author", "author")
          .leftJoinAndSelect("author.profileSettings", "profileSettings")
          .leftJoinAndSelect("post.likes", "like")
          .leftJoinAndSelect("like.user", "likedUser")
          .leftJoinAndSelect("like.user", "lastLikedUser")
          .leftJoinAndSelect("post.poll", "poll") // Include poll data
          .leftJoinAndSelect("poll.votes", "pollVotes") // Include poll votes
          .leftJoinAndSelect("post.comments", "comment")
          .leftJoinAndSelect("comment.user", "commentUser")
          .leftJoinAndSelect("post.page", "page")
          .leftJoinAndSelect("page.followers", "follower")
          .leftJoinAndSelect("post.group", "group")
          .leftJoinAndSelect("group.followers", "groupFollower")
          .leftJoinAndSelect("group.admins", "groupAdmin")
          .leftJoinAndSelect("groupAdmin.admin", "adminUser")
          .leftJoinAndSelect("post.groupPostRequests", "request")
          // .andWhere("(post.group IS NULL OR request.status = :status)", {
          //   status: PostRequestStatus.APPROVED,
          // })
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
            "group",
            "groupFollower",
            "groupAdmin",
            "adminUser",
            "profileSettings",
            "request",
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
          if (post.groupPostRequests) {
            post.groupPostRequests = post.groupPostRequests.filter(
              (request) => request.status === PostRequestStatus.APPROVED
            );
          }
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
          if (post.author.profileSettings) {
            const user = post.author;
            const settings = user.profileSettings;
            let about = user.about as any;

            const filteredProfile: any = buildFilteredProfile(
              user,
              about,
              settings
            );
            (post as any).author = filteredProfile;
          }

          (post as any).canComment = canComment;

          const isSaved = await this.savedRepo.find({
            where: { user: { id: userId }, post: { id } },
          });
          if (isSaved.length > 0) {
            (post as any).isSaved = true;
          } else {
            (post as any).isSaved = false;
          }

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

            (post as any).groupFollowerCount = post.group.followers.length;
            (post as any).isAdmin = post.group.admins.some(
              (admin) => admin.admin.id === userId
            );
            (post as any).isCreator = post.group.creatorId === userId;
            delete post.group.followers;
          }

          for (const like of post.likes) {
            const likeUserId = like.user.id;

            const bond = await this.bondsRepo.findOne({
              where: [
                {
                  requester: { id: userId as string },
                  recipient: { id: likeUserId },
                },
                {
                  requester: { id: likeUserId },
                  recipient: { id: userId as string },
                },
              ],
            });

            (like as any).isBond = !!bond; // true if bond exists, false otherwise
          }

          // If the post is a poll, include vote statistics
          if (post.type === PostType.POLL && post.poll) {
            const voteCounts = await this.getPollVoteCounts(post.poll);
            const userVote = this.getUserPollVote(post.poll, userId as string);

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

  async getCatchUpData(
    req: ICustomRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const loggedInUserId = req.user.id;
      let currentDate = new Date();
      let currentDay = currentDate.getUTCDate();
      let currentMonth = currentDate.getUTCMonth();
      const thirtyDaysAgo = new Date(
        currentDate.getTime() - 30 * 24 * 60 * 60 * 1000
      );
      const formatDate = (date: Date) =>
        `${date.getUTCMonth() + 1}-${date.getUTCDate()}`;

      const past30Days = new Set<string>();
      for (let i = 0; i <= 30; i++) {
        const date = new Date(currentDate.getTime() - i * 24 * 60 * 60 * 1000);
        past30Days.add(formatDate(date));
      }

      const bonds = await this.bondsRepo.find({
        where: [
          { requester: { id: loggedInUserId }, status: BondStatus.ACCEPTED },
          { recipient: { id: loggedInUserId }, status: BondStatus.ACCEPTED },
        ],
        relations: ["requester", "recipient"],
      });

      const bondedUsers = bonds.map((bond) =>
        bond.requester.id === loggedInUserId ? bond.recipient : bond.requester
      );

      const chats = await Chat.find({ members: req.user._id });

      const birthdays = [];
      const anniversaries = [];
      const jobChanges = [];
      const educationChanges = [];

      for (const user of bondedUsers) {
        let about: any = {};

        try {
          if (user.about && typeof user.about === "string") {
            about = JSON.parse(user.about);
          } else {
            about = user.about || {};
          }
        } catch {
          about = {};
        }
        const educations = Array.isArray(about.education)
          ? about.education
          : [];
        for (const edu of educations) {
          const startDate = new Date(edu.startDate);
          const endDate = new Date(edu.endDate);
          if (startDate >= thirtyDaysAgo && startDate <= currentDate) {
            educationChanges.push({
              id: user.id,
              userChatId: user.userChatId,
              chatId: chats.find((chat) =>
                chat.members.includes(user.userChatId)
              )?._id,
              firstName: user.firstName,
              lastName: user.lastName,
              profileImage: user.profileImage,
              institution: edu.institution,
              changeType: "startedEducation",
              date: startDate.toISOString(),
            });
          }

          if (endDate >= thirtyDaysAgo && endDate <= currentDate) {
            educationChanges.push({
              id: user.id,
              userChatId: user.userChatId,
              chatId: chats.find((chat) =>
                chat.members.includes(user.userChatId)
              )?._id,
              firstName: user.firstName,
              lastName: user.lastName,
              profileImage: user.profileImage,
              institution: edu.institution,
              changeType: "endedEducation",
              date: endDate.toISOString(),
            });
          }
        }

        if (about.dob) {
          const dob = new Date(about.dob);
          dob.setUTCHours(0, 0, 0, 0);

          const age = currentDate.getUTCFullYear() - dob.getUTCFullYear();
          const dobKey = formatDate(dob);

          if (past30Days.has(dobKey)) {
            birthdays.push({
              id: user.id,
              userChatId: user.userChatId,
              chatId: chats.find((chat) =>
                chat.members.includes(user.userChatId)
              )?._id,

              firstName: user.firstName,
              lastName: user.lastName,
              profileImage: user.profileImage,
              dob: about.dob,
              age,
            });
          }
        }

        const experiences = Array.isArray(about.experience)
          ? about.experience
          : [];
        for (const exp of experiences) {
          if (exp.startDate && exp.currently) {
            const startDate = new Date(`${exp.startDate}`);
            startDate.setUTCHours(0, 0, 0, 0);
            const years =
              currentDate.getUTCFullYear() - startDate.getUTCFullYear();

            if (
              // startDate.getUTCDate() === currentDay &&
              startDate.getUTCMonth() === currentMonth &&
              currentDate.getUTCFullYear() - startDate.getUTCFullYear() >= 1
            ) {
              anniversaries.push({
                id: user.id,

                userChatId: user.userChatId,
                chatId: chats.find((chat) =>
                  chat.members.includes(user.userChatId)
                )?._id,
                firstName: user.firstName,
                lastName: user.lastName,
                profileImage: user.profileImage,
                company: exp.company,
                yearsCompleted: years,
                designation: exp.title,
                startedOn: startDate.toISOString(),
              });
              break;
            }
          }
        }

        for (const exp of experiences) {
          if (exp.startDate && exp.currently) {
            const startDate = new Date(`${exp.startDate}`); // assuming YYYY-MM format

            if (startDate >= thirtyDaysAgo && startDate <= currentDate) {
              jobChanges.push({
                id: user.id,
                userChatId: user.userChatId,
                chatId: chats.find((chat) =>
                  chat.members.includes(user.userChatId)
                )?._id,
                firstName: user.firstName,
                lastName: user.lastName,
                profileImage: user.profileImage,
                company: exp.company,
                startedOn: startDate,
                designation: exp.title,
              });
              break;
            }
          }
        }
      }

      const result = {
        birthdays,
        anniversaries,
        jobChanges,
        educationChanges,
      };

      res
        .status(HTTP_STATUS.OK)
        .json(handleResponse("Catch-up data fetched successfully", result));
      return next();
    } catch (error) {
      logger.error(
        `UserController :: getCatchUpData :: ${(error as Error).message}`
      );
      return next(error);
    }
  }
}
