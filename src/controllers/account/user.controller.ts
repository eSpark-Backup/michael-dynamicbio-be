import { NextFunction, Request, RequestHandler, Response } from "express";
import {
  Bond,
  BondStatus,
  Poll,
  Post,
  PostStatus,
  PostType,
  ProfileSettings,
  ProfileStatus,
  User,
} from "../../entity";

import { ApiError } from "../../errors";
import { Repository } from "typeorm";
import {
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
import { CHAT_COOKIE, CLOUD_FOLDERS, HTTP_STATUS } from "../../constants";
import jwt from "jsonwebtoken";
import { UserForChat } from "../../models";

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
    private bondsRepo: Repository<Bond>
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
      if (user.imageKey && imageFileObjects.length>0) {
        if (imageFileObjects && oldUserImage !== imageUrls[0]?.url) {
          await uploadService.deleteFile(user.imageKey);
        }
      }
      const oldUserCover = user.coverImage;
      if (user.coverImageKey && coverFileObjects.length>0) {
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

      // const chatUser = await UserForChat.findById(req.user?._id);
      // chatUser.name = name;
      // await chatUser.save();

      const updatedUser = await this.usersRepo.save(user);

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
        .where("post.status = :status", { status: PostStatus.PUBLISH })
        .andWhere("post.author IN (:...bondedUserIds)", { bondedUserIds })
        .leftJoinAndSelect("post.author", "author")
        .leftJoinAndSelect("post.likes", "like")
        .leftJoinAndSelect("like.user", "likedUser")
        .leftJoinAndSelect("like.user", "lastLikedUser")
        .leftJoinAndSelect("post.poll", "poll") // Include poll data
        .leftJoinAndSelect("poll.votes", "pollVotes") // Include poll votes
        .leftJoinAndSelect("post.comments", "comment")

        .select([
          "post",
          "author",
          "like",
          "likedUser.id",
          "likedUser.firstName",
          "likedUser.lastName",
          "lastLikedUser.firstName",
          "lastLikedUser.lastName",
          "comment",
          "poll", // Include poll fields
          "pollVotes.id",
          "pollVotes.optionIndex",
          "pollVotes.userId",
          "pollVotes.createdAt",
        ])
        .orderBy("post.createdAt", "DESC")
        .addOrderBy("like.createdAt", "DESC")
        .skip(skipNumber)
        .take(takeNumber)
        .getManyAndCount();

      // Process each post
      for (const post of posts) {
        praseMedia(post);
        (post as any).shareableLink= generateShareableLink({
          id: post.id,
          type: "post",
          typeName: post.type,
        }),
        (post as any).likesCount = post.likes.length;
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

  // Helper method to get all options that a user has voted on
  private getUserPollVotes(poll: Poll, userId: string): number[] {
    if (!poll || !poll.votes || !userId) {
      return [];
    }

    // Find all votes by this user
    const userVotes = poll.votes.filter((vote) => vote.userId === userId);

    // Extract the option indices
    return userVotes.map((vote) => vote.optionIndex);
  }

  // Helper method to calculate poll vote statistics
  private async getPollVoteCounts(poll: Poll): Promise<any[]> {
    if (!poll || !poll.options) {
      return [];
    }

    // Get all votes for this poll
    const votes = poll.votes || [];
    const totalVotes = votes.length;

    // Count votes for each option
    const voteCounts = poll.options.map((option, index) => {
      const optionVotes = votes.filter((vote) => vote.optionIndex === index);
      return {
        option, // Include the actual option name
        optionIndex: index,
        count: optionVotes.length,
        percentage:
          totalVotes > 0
            ? Math.round((optionVotes.length / totalVotes) * 100)
            : 0,
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

      const { password: _, ...userProfile } = user as User;

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
      const userId=req.user?.id;
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
      }else if (type ==="post"){
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
                  .select([
                    "post",
                    "author",
                    "like",
             
                    "likeUser.id",
                    "likeUser.firstName",
                    "likeUser.lastName",
                    "likeUser.profileImage",
        
                    // "lastLikedUser.firstName",
                    // "lastLikedUser.lastName",
                    "poll",
                    "pollVotes.id",
                    "pollVotes.optionIndex",
                    "pollVotes.userId",
                    "comment",
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

                  if(userId){
                  (like as any).isBond = !!bond; 
                  }else {
                    (like as any).isBond = false; 
                  }

                }
                (singlePost as any).shareableLink= generateShareableLink({
                  id: singlePost.id,
                  type: "post",
                  typeName: singlePost.type,
                }),
        
                res
                  .status(200)
                  .json(handleResponse("Post Found Successfully", singlePost));
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
        `UserController :: updateProfileSettings :: ${(error as Error)?.message}`
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
      const userId = req.query.userId;
  
      const user = await this.usersRepo
        .createQueryBuilder("user")
        .leftJoinAndSelect("user.profileSettings", "profileSettings")
        .where("user.id = :userId", { userId })
        .getOne();
  
      if (!user) {
        throw new ApiError("User profile not found", HTTP_STATUS.NOT_FOUND);
      }
  
      const settings = user.profileSettings;
      const about = user.about as any;
  
      const filteredProfile: any = {
        firstName: user.firstName,
        ...(settings?.showLastName && { lastName: user.lastName }),
        ...(settings?.showEmail && { email: user.email }),
        ...(settings?.showProfilePhoto && { profileImage: user.profileImage }),
        ...(settings?.showHeadline && { designation: user.designation }),
        ...(settings?.showSummary && { bio: about?.bio }),
        ...(settings?.showOrganizationsAndInterests && {
          company: user.company,
          industry: user.industry,
        }),
        ...(settings?.showCurrentExperience && {
          currentExperience: about?.experience?.filter((exp: { currently: any; }) => exp?.currently),
        }),
        ...(settings?.showPastExperience && {
          pastExperience: about?.experience?.filter((exp: { currently: any; }) => !exp?.currently),
        }),
        ...(settings?.showEducation && { education: about?.education }),
        ...(settings?.showCertifications && { certifications: about?.certifications }),
        ...(settings?.showProjects && { projects: about?.projects }),
        ...(settings?.showLanguages && { languages: about?.languages }),
        ...(settings?.showSkills && { skills: about?.skill }),
        ...(settings?.pageVisitVisibility && {
          city: user.city,
          country: user.country,
        }),
      };
  
      res
        .status(HTTP_STATUS.OK)
        .json(handleResponse("User profile retrieved successfully", filteredProfile));
    } catch (error) {
      logger.error(`UserController :: getUserProfile :: ${(error as Error)?.message}`);
      return next(error);
    }
  }
  
}
