import { NextFunction, Request, RequestHandler, Response } from "express";
import { User } from "../../entity";

import { ApiError } from "../../errors";
import { Repository } from "typeorm";
import {
  decrypt,
  generateToken,
  handleResponse,
  logger,
  verifyToken,
} from "../../utils";
import { CLOUD_FOLDERS, HTTP_STATUS } from "../../constants";
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
    private notificationModel: typeof Notification
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
        .filter((file) => file.startsWith("image")); // Filter for image files

      const imageFileObjects: IFileObject[] = imageFiles.map((file) =>
        commonHelper.createFileObject(path.join(imageFilesPath, file), "image")
      );

      let { country, industry, company, designation } = req.body;

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
      user.designation = designation || user.designation;

      await this.usersRepo.save(user);
      const { password: _, ...userProfile } = user;
      userProfile.coverImages = JSON.parse(
        userProfile.coverImages as Object as string
      );

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
      const { firstName, lastName, ...rest } = req.body;

      const name = [firstName, lastName].filter(Boolean).join(" ");

      // Retrieve user
      const user = await this.usersRepo
        .createQueryBuilder("user")
        .where("user.id = :userId", { userId })
        .getOne();

      if (!user) {
        throw new ApiError("User not found", HTTP_STATUS.NOT_FOUND);
      }

      const updatedData = {
        ...user,
        ...rest,
        ...(name && { name }),
      };

      const chatUser = await UserForChat.findById(req.user?._id);
      chatUser.name = name;
      await chatUser.save();

      const updatedUser = await this.usersRepo.save(updatedData);

      const { password: _, ...userProfile } = updatedUser;

      res
        .status(HTTP_STATUS.OK)
        .json(handleResponse("User profile updated successfully", userProfile));
    } catch (error) {
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
        .createQueryBuilder('user')
        .where('user.id = :userId', { userId })
        .getOne();
  
      if (!user) {
        throw new ApiError('User or secret not found', HTTP_STATUS.NOT_FOUND);
      }


      const { token, expiresAt } = generateToken(
        { userId: user.id, newEmail: user.email },
        "1h"
      );

      const resetLink = `${process.env.FRONTEND_URL}verify-device?token=${token}&expiresAt=${expiresAt}`;
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
        `AuthController :: Register New Device For 2FA :: "${(error as Error)?.message}"`
      );
      return next(error);
    }
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
      // Retrieve the authenticated user's details
      const userId = req.user?.id;
      const user = (await this.usersRepo
        .createQueryBuilder("user")
        .where("user.id = :userId", { userId })
        .getOne()) as User;
      if (!user) {
        throw new ApiError("User profile not found", HTTP_STATUS.NOT_FOUND);
      }

      const { password: _, ...userProfile } = user as User;

      userProfile.coverImages = JSON.parse(
        userProfile.coverImages as Object as string
      );
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
        .createQueryBuilder('user')
        .where('user.id = :userId', { userId })
        .getOne();
  
      if (!user || !user.secret) {
        throw new ApiError('User or secret not found', HTTP_STATUS.NOT_FOUND);
      }
      otplib.authenticator.options = { window: 1 };

  
      const isFirstValid = otplib.authenticator.check(firstToken, user.secret);
  
      const nextToken = otplib.authenticator.generate(user.secret);
      const isSecondValid = secondToken === nextToken;
  
      if (isFirstValid && isSecondValid) {
        res.status(HTTP_STATUS.OK).json(
          handleResponse('2FA resynchronized successfully')
        );
      } else {
        throw new ApiError('Failed to resynchronize 2FA', HTTP_STATUS.BAD_REQUEST);
      }
    } catch (error) {
      logger.error(`UserController :: verifyResync :: ${(error as Error)?.message}`);
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
        throw new ApiError("Register to a Authenticator First", HTTP_STATUS.BAD_REQUEST);
      }

      const isValid = otplib.authenticator.check(
        req.body.token,
        user.secret
      );
      if (!isValid) {
        throw new ApiError("Invalid token", HTTP_STATUS.BAD_REQUEST);
      }

      user.is2FAEnabled = true;
      await this.usersRepo.save(user);
      res.status(HTTP_STATUS.OK).json(
        handleResponse("2FA enabled successfully", {
          is2FAEnabled: user.is2FAEnabled,
        })
      );

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
      res.status(HTTP_STATUS.OK).json(
        handleResponse("QR Code generated successfully", {
          qrcode,
          secret,
        })
      );
    } catch (error) {
      logger.error(
        `UserController :: generateQr :: ${(error as Error)?.message}`
      );
      return next(error);
    }
  }
}
