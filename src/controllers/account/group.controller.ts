import { ICustomRequest, IFileObject, IFileRequest } from "../../interfaces";

import { User, Group } from "../../entity";
import { Repository } from "typeorm";
import { NextFunction, Response } from "express";

import fs from "fs";
import path from "path";
import { ApiError } from "../../errors";
import { CLOUD_FOLDERS, HTTP_STATUS } from "../../constants";
import { commonHelper } from "../../helpers";
import { generateShareableLink, handleResponse, logger } from "../../utils";
import { uploadService } from "../../services";
import { Notification } from "../../models";

export class GroupController {
  constructor(
    private usersRepo: Repository<User>,
    private groupRepo: Repository<Group>,
    private notificationModel: typeof Notification
  ) {}

  async createGroup(
    req: ICustomRequest,
    file: IFileRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const {
        name,
        status,
        address,
        industry,
        description,
        rules,
        allowMemberInvites,
        requirePostApproval,
      } = req.body;

      const userId = req.user?.id;
      const user = await this.usersRepo.findOne({ where: { id: userId } });

      if (!user) {
        throw new ApiError("User not found", HTTP_STATUS.NOT_FOUND);
      }

      // Handle file uploads
      const uploadsPath = path.join(process.cwd(), "uploads");
      const logoFiles = fs
        .readdirSync(uploadsPath)
        .filter((file) => file.startsWith("logo"));
      const coverFiles = fs
        .readdirSync(uploadsPath)
        .filter((file) => file.startsWith("cover"));

      const logoFileObjects: IFileObject[] = logoFiles.map((file) =>
        commonHelper.createFileObject(path.join(uploadsPath, file), "logo")
      );

      const coverFileObjects: IFileObject[] = coverFiles.map((file) =>
        commonHelper.createFileObject(path.join(uploadsPath, file), "cover")
      );

      const folderName = `${CLOUD_FOLDERS.PAGE}/${name.replace(/\s+/g, "_")}`;

      // Upload files to cloud storage
      const logoUrls =
        logoFileObjects.length > 0
          ? await commonHelper.uploadFiles(logoFileObjects, folderName)
          : [];

      const coverUrls =
        coverFileObjects.length > 0
          ? await commonHelper.uploadFiles(coverFileObjects, folderName)
          : [];

      // Create new page
      const newGroup = new Group();
      newGroup.name = name;
      newGroup.status = status;
      newGroup.address = address;
      newGroup.description = description;
      newGroup.rules = rules;
      newGroup.industry = industry;
      newGroup.allowMemberInvites = allowMemberInvites;
      newGroup.requirePostApproval = requirePostApproval;
      newGroup.creator = user;
      newGroup.creatorId = user.id;

      // Set logo and cover image if uploaded
      if (logoUrls.length > 0) {
        newGroup.logoUrl = logoUrls[0].url;
        newGroup.logoPublicId = logoUrls[0].public_id;
      }

      if (coverUrls.length > 0) {
        newGroup.coverImageUrl = coverUrls[0].url;
        newGroup.coverImagePublicId = coverUrls[0].public_id;
      }

      // Set creator as admin
      newGroup.admins = [user];

      // Save page
      const savedPage = await this.groupRepo.save(newGroup);

      const files = fs.readdirSync(uploadsPath);
      files.forEach((file) => {
        const filePath = path.join(uploadsPath, file);
        fs.unlinkSync(filePath);
      });

      res
        .status(HTTP_STATUS.CREATED)
        .json(handleResponse("Group created successfully", savedPage));
    } catch (error) {
      // Clean up any uploaded files in case of error
      const uploadsPath = path.join(process.cwd(), "uploads");
      const files = fs.readdirSync(uploadsPath);
      files.forEach((file) => {
        const filePath = path.join(uploadsPath, file);
        fs.unlinkSync(filePath);
      });

      logger.error(
        `GroupController :: createGroup :: ${(error as Error)?.message}`
      );
      return next(error);
    }
  }

  async updateGroup(
    req: ICustomRequest,
    file: IFileRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { id } = req.params;
      const {
        name,
        status,
        address,
        industry,
        description,
        rules,
        allowMemberInvites,
        requirePostApproval,
      } = req.body;

      const userId = req.user?.id;

      const group = await this.groupRepo
        .createQueryBuilder("group")
        .leftJoinAndSelect("group.admins", "admin")
        .where("group.id = :id", { id })
        .getOne();

      if (!group) {
        throw new ApiError("Group not found", HTTP_STATUS.NOT_FOUND);
      }

      // Check if user is an admin
      const isAdmin = group.admins.some((admin) => admin.id === userId);
      if (!isAdmin) {
        throw new ApiError(
          "You are not authorized to update this group",
          HTTP_STATUS.FORBIDDEN
        );
      }

      // Handle file uploads
      const uploadsPath = path.join(process.cwd(), "uploads");
      const logoFiles = fs
        .readdirSync(uploadsPath)
        .filter((file) => file.startsWith("logo"));
      const coverFiles = fs
        .readdirSync(uploadsPath)
        .filter((file) => file.startsWith("cover"));

      const logoFileObjects: IFileObject[] = logoFiles.map((file) =>
        commonHelper.createFileObject(path.join(uploadsPath, file), "logo")
      );

      const coverFileObjects: IFileObject[] = coverFiles.map((file) =>
        commonHelper.createFileObject(path.join(uploadsPath, file), "cover")
      );

      const folderName = `${CLOUD_FOLDERS.PAGE}/${group.name.replace(
        /\s+/g,
        "_"
      )}`;

      // Upload files to cloud storage
      let logoUrl, logoPublicId, coverImageUrl, coverImagePublicId;

      if (logoFileObjects.length > 0) {
        const logoUrls = await commonHelper.uploadFiles(
          logoFileObjects,
          folderName
        );
        if (logoUrls.length > 0) {
          logoUrl = logoUrls[0].url;
          logoPublicId = logoUrls[0].public_id;

          // Delete old logo if exists
          if (group.logoPublicId) {
            await uploadService.deleteFile(group.logoPublicId);
          }
        }
      }

      if (coverFileObjects.length > 0) {
        const coverUrls = await commonHelper.uploadFiles(
          coverFileObjects,
          folderName
        );
        if (coverUrls.length > 0) {
          coverImageUrl = coverUrls[0].url;
          coverImagePublicId = coverUrls[0].public_id;

          // Delete old cover image if exists
          if (group.coverImagePublicId) {
            await uploadService.deleteFile(group.coverImagePublicId);
          }
        }
      }

      if (name) group.name = name;
      if (status) group.status = status;
      if (address) group.address = address;
      if (industry) group.industry = industry;
      if (description) group.description = description;
      if (rules) group.rules = rules;
      if (allowMemberInvites !== undefined)
        group.allowMemberInvites = allowMemberInvites;

      if (requirePostApproval !== undefined)
        group.requirePostApproval = requirePostApproval;

      if (logoUrl) group.logoUrl = logoUrl;
      if (logoPublicId) group.logoPublicId = logoPublicId;
      if (coverImageUrl) group.coverImageUrl = coverImageUrl;
      if (coverImagePublicId) group.coverImagePublicId = coverImagePublicId;

      // Save updated page
      const updatedPage = await this.groupRepo.save(group);

      // Clean up uploaded files
      const files = fs.readdirSync(uploadsPath);
      files.forEach((file) => {
        const filePath = path.join(uploadsPath, file);
        fs.unlinkSync(filePath);
      });

      res
        .status(HTTP_STATUS.OK)
        .json(handleResponse("Page updated successfully", updatedPage));
    } catch (error) {
      // Clean up any uploaded files in case of error
      const uploadsPath = path.join(process.cwd(), "uploads");
      const files = fs.readdirSync(uploadsPath);
      files.forEach((file) => {
        const filePath = path.join(uploadsPath, file);
        fs.unlinkSync(filePath);
      });

      logger.error(
        `PageController :: updatePage :: ${(error as Error)?.message}`
      );
      return next(error);
    }
  }

  async deleteGroup(
    req: ICustomRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.user?.id;

      const group = await this.groupRepo
        .createQueryBuilder("group")
        .leftJoinAndSelect("group.admins", "admin")
        .where("group.id = :id", { id })
        .getOne();

      if (!group) {
        throw new ApiError("Group not found", HTTP_STATUS.NOT_FOUND);
      }

      const isAdmin = group.admins.some((admin) => admin.id === userId);
      if (!isAdmin) {
        throw new ApiError(
          "You are not authorized to delete this group",
          HTTP_STATUS.FORBIDDEN
        );
      }

      await this.groupRepo.remove(group);

      res
        .status(HTTP_STATUS.OK)
        .json(handleResponse("Group deleted successfully"));
    } catch (error) {
      logger.error(
        `GroupController :: deleteGroup :: ${(error as Error)?.message}`
      );
      return next(error);
    }
  }
}
