import { NextFunction, Request, RequestHandler, Response } from "express";
import { Bond, BondStatus, ProfileStatus, User } from "../../entity";
import { commonHelper } from "../../helpers";

import { ApiError } from "../../errors";
import { Repository } from "typeorm";
import {
  cookieOptions,
  decrypt,
  emitEvent,
  generateToken,
  handleResponse,
  logger,
  verifyToken,
} from "../../utils";
import {
  BOND_REQUEST_UPDATED,
  CHAT_COOKIE,
  CLOUD_FOLDERS,
  HTTP_STATUS,
  NEW_BOND_REQUEST,
} from "../../constants";
import jwt from "jsonwebtoken";
import { UserForChat } from "../../models";

import bcrypt from "bcryptjs";
import {
  EventDate,
  ICustomRequest,
  IFileObject,
  UploadResult,
} from "../../interfaces";
import { createNotification } from "../../services";
import { object } from "joi";

export class BondController {
  constructor(
    private usersRepo: Repository<User>,
    private bondsRepo: Repository<Bond>
  ) {}

  async createBond(
    req: ICustomRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { recipientId } = req.body;
      const requesterId = req.user.id;
      const requester = await this.usersRepo
        .createQueryBuilder("user")
        .where("user.id = :id", { id: requesterId })
        .getOne();
      if (!requester) {
        throw new ApiError("Requester not found", HTTP_STATUS.NOT_FOUND);
      }

      const recipient = await this.usersRepo
        .createQueryBuilder("user")
        .where("user.id = :id", { id: recipientId })
        .getOne();
      if (!recipient) {
        throw new ApiError("Recipient not found", HTTP_STATUS.NOT_FOUND);
      }

      if (recipientId === requesterId) {
        throw new ApiError(
          "You cannot create a bond with yourself",
          HTTP_STATUS.BAD_REQUEST
        );
      }

      const existingBond = await this.bondsRepo.findOne({
        where: [
          { requester: { id: requesterId }, recipient: { id: recipientId } },
          { requester: { id: recipientId }, recipient: { id: requesterId } },
        ],
      });

      if (existingBond && existingBond.status !== BondStatus.CANCELED) {
        throw new ApiError(
          "Bond already exists or pending",
          HTTP_STATUS.BAD_REQUEST
        );
      }
      let bond: Bond;
      if(existingBond && existingBond.status === BondStatus.CANCELED) {
        existingBond.status = BondStatus.PENDING;
        bond= await this.bondsRepo.save(existingBond);
      }else {
       bond = this.bondsRepo.create({
        requester: { id: requesterId },
        recipient: { id: recipientId },
        status: BondStatus.PENDING,
      });
      await this.bondsRepo.save(bond);

    }

      const members = [recipient.userChatId];
      const notificationData = {
        title: "New Bond Request 💖",
        message: `${requester.firstName} ${requester.lastName} sent you a bond request!`,
        bondId: bond.id,
        requesterId: requester.userChatId,
        requesterProfileImage: requester.profileImage,
        bondStatus: BondStatus.PENDING,
      };

      emitEvent(req, NEW_BOND_REQUEST, members, notificationData);

      await createNotification({
        userId: recipient.userChatId,
        title: "New Bond Request 💖",
        message: `${requester.firstName} ${requester.lastName} sent you a bond request!`,
        type: "info",
        metadata: {
          bondId: bond.id,
          requesterId: requester.userChatId,
          requesterName: `${requester.firstName} ${requester.lastName}`,
          requesterProfileImage: requester.profileImage,
          bondStatus: BondStatus.PENDING,
        },
      });

      res
        .status(HTTP_STATUS.CREATED)
        .json(handleResponse("Bond request sent successfully", bond));
    } catch (error) {
      logger.error(`Error creating bond: ${error.message}`);
      return next(error);
    }
  }

  async getAllUsers(
    req: ICustomRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { page, pageSize, search = "", id, skip } = req.query as any;

      let query = this.usersRepo
        .createQueryBuilder("user")
        .where("user.id != :id", { id: req.user.id });

      if (id) {
        query = query.andWhere("user.id = :userId", { userId: id });
      } else if (search) {
        query = query.andWhere(
          `(user.firstName LIKE :search OR user.lastName LIKE :search OR user.email LIKE :search)`,
          { search: `%${search}%` }
        );
      }

      const [users, total] = await query
        .select([
          "user.id",
          "user.firstName",
          "user.lastName",
          "user.email",
          "user.profileImage",
          "user.countryCode",
          "user.phoneNumber",
          "user.about",
          "user.coverImage",
          "user.imageKey",
          "user.coverImageKey",
          "user.sendEmails",
          "user.profile",
          "user.userChatId",
          "user.designation",
          "user.about",
        ])
        .skip(skip)
        .take(pageSize)
        .getManyAndCount();

      res.status(200).json({
        status: true,
        data: {
          users,
          pagination: {
            totalItems: total,
            currentPage: +page,
            pageSize: +pageSize,
            totalPages: Math.ceil(total / pageSize),
          },
        },
        message: "Users fetched successfully",
        statusCode: 200,
      });
    } catch (error) {
      next(error);
    }
  }

  async getAllUserFriends(
    req: ICustomRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = req.user.id;
  
      const bonds = await this.bondsRepo.find({
        where: [
          {
            requester: { id: userId },
            status: BondStatus.ACCEPTED, 
          },
          {
            recipient: { id: userId },
            status: BondStatus.ACCEPTED, 
          },
        ],
        relations: ["requester", "recipient"],
        select: {
          requester: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            profileImage: true,
            countryCode: true,
            phoneNumber: true,
            about: object,
            coverImage: true,
            imageKey: true,
            sendEmails: true,
            profile: true,
            userChatId: true,
            designation: true,
            createdAt:true,
            updatedAt:true
          },
          recipient: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            profileImage: true,
            countryCode: true,
            phoneNumber: true,
            about: object,
            coverImage: true,
            imageKey: true,
            sendEmails: true,
            profile: true,
            userChatId: true,
            designation: true,
            createdAt:true,
            updatedAt:true
          },
        },
      });
  
      const friends = bonds.map((bond) => {
        return bond.requester.id === userId ? bond.recipient : bond.requester;
      });
  
      res.status(HTTP_STATUS.OK).json({
        status: true,
        data: friends,
        message: "User friends fetched successfully",
      });
    } catch (error) {
      next(error);
    }
  }
  
  async getAllBondRequests(
    req: ICustomRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = req.user.id;
      const {
        type = "all",
        skip = "0",
        take = "10",
        page = "1",
        pageSize = "10",
      } = req.query;

      let whereCondition: any;

      if (type === "sent") {
        whereCondition = {
          requester: { id: userId },
          status: BondStatus.PENDING,
        };
      } else if (type === "received") {
        whereCondition = {
          recipient: { id: userId },
          status: BondStatus.PENDING,
        };
      } else {
        whereCondition = [
          { requester: { id: userId }, status: BondStatus.PENDING },
          { recipient: { id: userId }, status: BondStatus.PENDING },
        ];
      }

      const [bonds, totalItems] = await this.bondsRepo.findAndCount({
        where: whereCondition,
        relations: ["requester", "recipient"],
        order: { createdAt: "DESC" },
        skip: Number(skip),
        take: Number(take),
      });

      res.status(HTTP_STATUS.OK).json(
        handleResponse("Bond requests fetched successfully", {
          bonds,
          pagination: {
            totalItems,
            currentPage: parseInt(page as string, 10),
            pageSize: parseInt(pageSize as string, 10),
            totalPages: Math.ceil(
              totalItems / parseInt(pageSize as string, 10)
            ),
          },
        })
      );
    } catch (error) {
      next(error);
    }
  }
  async updateBondStatus(
    req: ICustomRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { bondId, action } = req.body;
      const userId = req.user.id;

      const bond = await this.bondsRepo.findOne({
        where: { id: bondId },
        relations: ["requester", "recipient"],
      });

      if (!bond) {
        throw new ApiError("Bond not found", HTTP_STATUS.NOT_FOUND);
      }

      const recipientActions = ["accepted", "rejected", "blocked"];
      const requesterActions = ["canceled"];

      if (recipientActions.includes(action)) {
        if (bond.recipient.id !== userId) {
          throw new ApiError(
            "You are not authorized to perform this action",
            HTTP_STATUS.UN_AUTHORIZED
          );
        }
      } else if (requesterActions.includes(action)) {
        if (bond.requester.id !== userId) {
          throw new ApiError(
            "You are not authorized to perform this action",
            HTTP_STATUS.UN_AUTHORIZED
          );
        }
      } else {
        throw new ApiError("Invalid action", HTTP_STATUS.BAD_REQUEST);
      }

      if (bond.status !== BondStatus.PENDING) {
        throw new ApiError(
          "Bond request is not pending",
          HTTP_STATUS.BAD_REQUEST
        );
      }

      const statusMap: Record<string, BondStatus> = {
        accepted: BondStatus.ACCEPTED,
        rejected: BondStatus.REJECTED,
        blocked: BondStatus.BLOCKED,
        canceled: BondStatus.CANCELED,
      };

      bond.status = statusMap[action];
      if(action === "accepted" || action === "blocked") {
      await this.bondsRepo.save(bond);
      }
      if (action === "canceled" || action === "rejected"  || action ==="unfriend") {
        await this.bondsRepo.remove(bond);
      }

      const members = [bond.requester.userChatId];
      const notificationData = {
        title: commonHelper.getNotificationTitle(action),
        message: commonHelper.getNotificationMessage(
          action,
          bond.recipient.firstName,
          bond.recipient.lastName
        ),
        bondId: bond.id,
        requesterId: bond.requester.userChatId,
        requesterProfileImage: bond.requester.profileImage,
        bondStatus: bond.status,
      };

      emitEvent(req, BOND_REQUEST_UPDATED, members, notificationData);

      await createNotification({
        userId: bond.requester.userChatId,
        title: notificationData.title,
        message: notificationData.message,
        type: "info",
        metadata: {
          bondId: bond.id,
          requesterId: bond.requester.userChatId,
          requesterName: `${bond.recipient.firstName} ${bond.recipient.lastName}`,
          requesterProfileImage: bond.recipient.profileImage,
          bondStatus: bond.status,
        },
      });

      res
        .status(HTTP_STATUS.OK)
        .json(handleResponse("Bond request updated successfully", bond));
    } catch (error) {
      next(error);
    }
  }
}
