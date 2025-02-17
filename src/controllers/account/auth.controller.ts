import { NextFunction, Request, RequestHandler, Response } from "express";
import { LoginType, User } from "../../entity";
import { ApiError } from "../../errors";
import { Repository } from "typeorm";
import * as otplib from "otplib";
import qrCode from "qrcode";
import {
  decrypt,
  generateToken,
  handleResponse,
  logger,
  verifyToken,
} from "../../utils";
import { CHAT_COOKIE, HTTP_STATUS, LOGIN_TYPE } from "../../constants";
import jwt from "jsonwebtoken";
import { UserForChat } from "../../models";
import bcrypt from "bcryptjs";
import { mailService } from "../../services/mail.service";
import { count } from "console";
import { configs } from "../../config";
const cookieOptions: {
  maxAge: number;
  sameSite: "none" | "lax" | "strict";
  httpOnly: boolean;
  secure: boolean;
} = {
  maxAge: 3600000,
  sameSite: "lax",
  httpOnly: true,
  secure: true,
};

export class AuthController {
  constructor(private usersRepo: Repository<User>) {}

  async registerUser(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const {
        firstName,
        lastName,
        email,
        countryCode,
        phoneNumber,
        role,
        loginType,
        isSocialLogin,
        socialId,
        profileImage,
      } = req.body;

      if (isSocialLogin) {
        if (!socialId || loginType == LOGIN_TYPE.LOCAL) {
          throw new ApiError(
            "Please provide socialId and profileImage for social login.",
            HTTP_STATUS.BAD_REQUEST
          );
        }

        const existingUser = (await this.usersRepo.findOne({
          where: { email, loginType },
        })) as User;

        if (existingUser && existingUser.isSocialLogin == false) {
          throw new ApiError(
            "Invalid Login Method or Email Already Exists",
            HTTP_STATUS.BAD_REQUEST
          );
        }

        if (existingUser && existingUser.loginType == loginType) {
          const userChat = await UserForChat.findById(existingUser.userChatId);
          let socketUser = userChat;
          if (!userChat) {
            const newUserChat = await UserForChat.create({
              name: firstName + " " + lastName,
              accountId: existingUser.id,
              username: email,
              password: "",
              bio: "",
            });
            socketUser = newUserChat;
            const usersocketId = socketUser._id;
            existingUser.userChatId = usersocketId.toString();
            await this.usersRepo.save(existingUser);
          }

          const token = jwt.sign(
            {
              id: existingUser.id,
              email: existingUser.email,
              role: existingUser.role,
              _id: socketUser._id,
            },
            process.env.JWT_SECRET!,
            { expiresIn: "24h" }
          );

          res.status(HTTP_STATUS.OK).json(
            handleResponse("Social Login successful", {
              token,
              user: existingUser,
            })
          );
          return next();
        }

        const user = new User();
        user.firstName = firstName;
        user.lastName = lastName;
        user.email = email;
        user.loginType = loginType;
        user.countryCode = countryCode;
        user.phoneNumber = phoneNumber;
        user.profileImage = profileImage;
        user.isSocialLogin = true;
        user.role = role;
        user.userChatId = "";

        user.socialId = socialId;

        const newUser = await this.usersRepo.save(user);

        let socketUser;

        const newUserChat = await UserForChat.create({
          name: firstName + " " + lastName,
          avatar: profileImage,
          accountId: newUser.id,
          username: email,
          password: "",
          bio: "",
        });
        socketUser = newUserChat;

        const usersocketId = socketUser._id;
        newUser.userChatId = usersocketId.toString();
        await this.usersRepo.save(newUser);

        const { token, expiresAt } = generateToken(
          { userId: newUser.id, newEmail: newUser.email },
          "1h"
        );
        const verifyLink = `${process.env.FRONTEND_URL}verify-email?token=${token}&expiresAt=${expiresAt}`;
        user.passwordResetExpire = expiresAt;
        await this.usersRepo.save(user);

        await mailService.verifyEmail({
          name: user.firstName + " " + user.lastName,
          email: email,
          link: verifyLink,
        });
        res
          .status(HTTP_STATUS.CREATED)
          .cookie(CHAT_COOKIE, token, cookieOptions)
          .json(
            handleResponse("Verification Link Sent Successfully", {
              user: newUser,
            })
          );
        return next();
      }

      const existingUser = await this.usersRepo.findOne({ where: { email } });
      if (existingUser) {
        throw new ApiError(
          "Email is already registered. Please log in.",
          HTTP_STATUS.ALREADY_EXISTS
        );
      }

      const user = new User();
      user.firstName = firstName;
      user.lastName = lastName;
      user.phoneNumber = phoneNumber;
      user.countryCode = countryCode;
      user.email = email;
      user.role = role;
      user.loginType = LoginType.LOCAL;
      user.isSocialLogin = false;



      const newUser = await this.usersRepo.save(user);

      const { token, expiresAt } = generateToken(
        { userId: newUser.id, newEmail: newUser.email },
        "1h"
      );
      const verifyLink = `${process.env.FRONTEND_URL}verify-email?token=${token}&expiresAt=${expiresAt}`;

      const userChat = await UserForChat.findOne({
        where: { accountId: newUser.id },
      });
      let socketUser = userChat;
      if (!userChat) {
        const newUserChat = await UserForChat.create({
          name: firstName + " " + lastName,
          accountId: newUser.id,
          username: email,
          password: "",
          bio: "",
        });
        socketUser = newUserChat;
        const usersocketId = socketUser._id;
        newUser.userChatId = usersocketId.toString();
        newUser.passwordResetExpire = expiresAt;

        await this.usersRepo.save(newUser);
      }
      await mailService.verifyEmail({
        name: user.firstName + " " + user.lastName,
        email: email,
        link: verifyLink,
      });

      res
        .status(HTTP_STATUS.CREATED)
        .cookie(CHAT_COOKIE, token, cookieOptions)
        .json(
          handleResponse("Verification Link Sent Successfully", {
            user: newUser,
          })
        );
    } catch (error) {
      logger.error(
        `AuthController :: registerUser :: ${(error as Error)?.message}`
      );
      return next(error);
    }
  }

  async deleteAccount(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { email } = req.body;

      const user = await this.usersRepo.findOne({ where: { email } });
      if (!user) {
        throw new ApiError("User not found.", HTTP_STATUS.NOT_FOUND);
      }

      await this.usersRepo.delete(user.id);

      res
        .status(HTTP_STATUS.OK)
        .json(handleResponse("Account deleted successfully."));
      return next();
    } catch (error) {
      logger.error(
        `AuthController :: deleteAccount :: ${(error as Error)?.message}`
      );
      return next(error);
    }
  }

  async loginUser(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { email, password, loginType, socialId } = req.body;

      // Check if the user exists
      const user = await this.usersRepo.findOne({ where: { email } });
      if (!user) {
        throw new ApiError(
          "Invalid email or password.",
          HTTP_STATUS.UN_AUTHORIZED
        );
      }

      // Handle Standard Login
      if (!password) {
        throw new ApiError("Password is required.", HTTP_STATUS.BAD_REQUEST);
      }
      if (user.isSocialLogin) {
        throw new ApiError(
          "This email is registered as a social login. Please use social login.",
          HTTP_STATUS.BAD_REQUEST
        );
      }

      // Compare hashed password
      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        throw new ApiError(
          "Invalid email or password.",
          HTTP_STATUS.UN_AUTHORIZED
        );
      }
      const userChat = await UserForChat.findById(user.userChatId);
      let socketUser = userChat;
      const token = jwt.sign(
        {
          id: user.id,
          email: user.email,
          role: user.role,
          _id: socketUser._id,
        },
        process.env.JWT_SECRET!,
        { expiresIn: "24h" }
      );
      const { password: _, ...userWithoutPassword } = user;

      res
        .status(HTTP_STATUS.OK)
        .cookie(CHAT_COOKIE, token, cookieOptions)
        .json(
          handleResponse("Login successful", { token, user:userWithoutPassword })
        );
      return next();
    } catch (error) {
      logger.error(
        `AuthController :: loginUser :: ${(error as Error)?.message}`
      );
      return next(error);
    }
  }

  async forgotPassword(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { email } = req.body;

      const user = await this.usersRepo.findOne({ where: { email } });

      if (!user) {
        throw new ApiError("User not found", HTTP_STATUS.NOT_FOUND);
      }

      if (user.isSocialLogin) {
        throw new ApiError(
          "This email is registered as a social login. Please use social login.",
          HTTP_STATUS.BAD_REQUEST
        );
      }

      const { token, expiresAt } = generateToken(
        { userId: user.id, newEmail: email },
        "1h"
      );

      const resetLink = `${process.env.FRONTEND_URL}reset-password?token=${token}&expiresAt=${expiresAt}`;
      user.passwordResetExpire = expiresAt;
      await this.usersRepo.save(user);

      await mailService.forgotPassword({
        name: user.firstName + " " + user.lastName,
        email: email,
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
        `AuthController :: forgotPassword :: "${(error as Error)?.message}"`
      );
      return next(error);
    }
  }
  async verifyRegisteredDevice(
      req: Request,
      res: Response,
      next: NextFunction
    ): Promise<void> {
      try {
        const { token, expiresAt } = req.params;
  
        if (!token || !expiresAt) {
          throw new ApiError(
            "Token and expiration time are required",
            HTTP_STATUS.BAD_REQUEST
          );
        }
  

  
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
  
        if (!payload) {
          throw new ApiError("Invalid token", HTTP_STATUS.BAD_REQUEST);
        }
  
        const user = await this.usersRepo.findOne({
          where: { id: payload.userId },
        });
  
        if (!user) {
          throw new ApiError("User not found", HTTP_STATUS.NOT_FOUND);
        }
        if (user.passwordResetExpire != expiresAt) {
          throw new ApiError(
            "Invalid token or Link Expired",
            HTTP_STATUS.BAD_REQUEST
          );
        }

      const secret = otplib.authenticator.generateSecret();
      const otpauthUrl = otplib.authenticator.keyuri(
        user.email,
        configs.QR_ISSUER,
        secret
      );
      user.secret = secret;

  
        
  
        user.passwordResetExpire = null;
   await this.usersRepo.save(user);
      const qrcode = await qrCode.toDataURL(otpauthUrl);
  
     
  
        res.status(HTTP_STATUS.OK).json(
          handleResponse("QR Code Generated For NEw 2FA Device", {
        qrcode,
        secret,
          })
        );
      } catch (error) {
        logger.error(
          `AuthController :: NEW Device Registered For 2FA :: "${(error as Error)?.message}"`
        );
        return next(error);
      }
    }

  async resetPassword(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { token, expiresAt } = req.params;
      const { newPassword } = req.body;

      if (!token || !expiresAt) {
        throw new ApiError(
          "Token and expiration time are required",
          HTTP_STATUS.BAD_REQUEST
        );
      }

      if (!newPassword) {
        throw new ApiError("Please provide password", HTTP_STATUS.BAD_REQUEST);
      }

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

      if (!payload) {
        throw new ApiError("Invalid token", HTTP_STATUS.BAD_REQUEST);
      }

      const user = await this.usersRepo.findOne({
        where: { id: payload.userId },
      });

      if (!user) {
        throw new ApiError("User not found", HTTP_STATUS.NOT_FOUND);
      }
      if (user.passwordResetExpire != expiresAt) {
        throw new ApiError(
          "Invalid token or Link Expired",
          HTTP_STATUS.BAD_REQUEST
        );
      }
      const isPasswordSame = await bcrypt.compare(newPassword, user.password);
      if (isPasswordSame) {
        throw new ApiError(
          "New password cannot be the same as the old password",
          HTTP_STATUS.BAD_REQUEST
        );
      }

      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(newPassword, salt);

      user.password = hashedPassword;
      user.passwordResetExpire = null;
      await this.usersRepo.save(user);

      res.status(HTTP_STATUS.OK).json(
        handleResponse("Password reset successfully", {
          id: user.id,
          email: user.email,
        })
      );
    } catch (error) {
      logger.error(
        `AuthController :: resetPassword :: "${(error as Error)?.message}"`
      );
      return next(error);
    }
  }

  async setPassword(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { token, expiresAt } = req.params;
      const { newPassword } = req.body;

      if (!token || !expiresAt) {
        throw new ApiError(
          "Token and expiration time are required",
          HTTP_STATUS.BAD_REQUEST
        );
      }

      if (!newPassword) {
        throw new ApiError("Please provide password", HTTP_STATUS.BAD_REQUEST);
      }

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

      if (!payload) {
        throw new ApiError("Invalid token", HTTP_STATUS.BAD_REQUEST);
      }

      const user = await this.usersRepo.findOne({
        where: { id: payload.userId },
      });

      if (!user) {
        throw new ApiError("User not found", HTTP_STATUS.NOT_FOUND);
      }
      if (user.passwordResetExpire != expiresAt) {
        throw new ApiError(
          "Invalid token or Link Expired",
          HTTP_STATUS.BAD_REQUEST
        );
      }


      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(newPassword, salt);

      user.password = hashedPassword;
      user.passwordResetExpire = null;
      user.isEmailVerified = true;
    const existingUser=  await this.usersRepo.save(user);

      const loginToken = jwt.sign(
        {
          id: existingUser.id,
          email: existingUser.email,
          role: existingUser.role,
          _id: existingUser.userChatId,
        },
        process.env.JWT_SECRET!,
        { expiresIn: "24h" }
      );


      res.status(HTTP_STATUS.OK).json(
        handleResponse("Password Set successfully", {
       token:loginToken,
          user: existingUser,
        })
      );
    } catch (error) {
      logger.error(
        `AuthController :: setPassword :: "${(error as Error)?.message}"`
      );
      return next(error);
    }
  }
}
