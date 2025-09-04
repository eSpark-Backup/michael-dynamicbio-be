import { ICustomRequest, IFileObject, IFileRequest } from "../../interfaces";

import {
  User,
  Group,
  GroupJoinRequest,
  GroupPostRequest,
  PostRequestStatus,
  GroupAdmin,
  Post,
  GroupStatus,
  PostStatus,
  PostVisibility,
  COMMENT_VISIBILITY,
  GroupRequestStatus,
} from "../../entity";
import { Repository } from "typeorm";
import { NextFunction, Response } from "express";

import fs from "fs";
import path from "path";
import { ApiError } from "../../errors";
import {
  CLOUD_FOLDERS,
  GROUP_POST_REQUEST_UPDATED,
  GROUP_REQUEST_UPDATED,
  HTTP_STATUS,
  NEW_GROUP_REQUEST,
} from "../../constants";
import { commonHelper } from "../../helpers";
import {
  emitEvent,
  generateShareableLink,
  handleResponse,
  logger,
} from "../../utils";
import { uploadService } from "../../services";
import { Notification } from "../../models";

export class GroupController {
  constructor(
    private usersRepo: Repository<User>,
    private groupRepo: Repository<Group>,
    private notificationModel: typeof Notification,
    private groupJoinRequestRepo: Repository<GroupJoinRequest>,
    private groupPostRequestRepo: Repository<GroupPostRequest>,
    private groupAdminRepo: Repository<GroupAdmin>,
    private postRepo: Repository<Post>
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

      // // Set creator as admin
      // newGroup.admins = [user];

      // Save page
      const savedPage = await this.groupRepo.save(newGroup);

      const groupAdmin = this.groupAdminRepo.create({
        group: savedPage,
        groupId: savedPage.id,
        admin: user,
        adminId: user.id,
        createdBy: user,
        createdById: user.id,
      });
      await this.groupAdminRepo.save(groupAdmin);

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
        .leftJoinAndSelect("group.creator", "creator")
        .leftJoinAndSelect("group.admins", "groupAdmin")
        .leftJoinAndSelect("groupAdmin.admin", "adminUser")
        .where("group.id = :id", { id })
        .getOne();

      if (!group) {
        throw new ApiError("Group not found", HTTP_STATUS.NOT_FOUND);
      }

      // Check if user is an admin

      const isCreator = group.creator?.id === userId;

      // const isAdmin = group.admins.some((admin) => admin.id === userId);
      if (!isCreator) {
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
      if (status) {
        group.status = status;
        const groupPost = await this.postRepo
          .createQueryBuilder("post")
          .where("post.groupId = :groupId", { groupId: group.id })
          .getMany();

        const savePromises = groupPost.map((post) => {
          if (status == GroupStatus.PRIVATE) {
            post.visibility = PostVisibility.GROUPS;
            post.commentVisibility = COMMENT_VISIBILITY.GROUPS;
          } else {
            post.visibility = PostVisibility.PUBLIC;
            post.commentVisibility = COMMENT_VISIBILITY.PUBLIC;
          }
          return this.postRepo.save(post);
        });

        await Promise.all(savePromises);
      }

      if (address) group.address = address;
      if (industry) group.industry = industry;
      if (description) group.description = description;
      if (rules) group.rules = rules;
      if (allowMemberInvites !== undefined) {
        group.allowMemberInvites = allowMemberInvites === "true";
      }

      if (requirePostApproval !== undefined) {
        group.requirePostApproval = requirePostApproval === "true";
      }

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
        .json(handleResponse("Group updated successfully", updatedPage));
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

  async getGroupById(
    req: ICustomRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.user?.id;

      const group = await this.groupRepo
        .createQueryBuilder("group")
        .leftJoinAndSelect("group.creator", "creator")
        .leftJoinAndSelect("group.admins", "admin")
        .leftJoinAndSelect("group.followers", "follower")
        .leftJoinAndSelect(
          "group.groupPostRequests",
          "postRequest",
          "postRequest.groupId = group.id AND postRequest.status = :status",
          { status: PostRequestStatus.PENDING }
        )
        .leftJoinAndSelect("group.admins", "groupAdmin")
        .leftJoinAndSelect("groupAdmin.admin", "adminUser")
        .leftJoinAndSelect("groupAdmin.createdBy", "adminCreatedBy")
        .leftJoinAndSelect(
          "group.groupJoinRequests",
          "joinRequest",
          "joinRequest.groupId = group.id AND joinRequest.isApproved = :isApproved",
          { isApproved: false }
        )
        .where("group.id = :id", { id })
        .getOne();

      if (!group) {
        throw new ApiError("Group not found", HTTP_STATUS.NOT_FOUND);
      }

      const joinRequests = await this.groupJoinRequestRepo
        .createQueryBuilder("request")
        .leftJoinAndSelect("request.group", "group")
        .where("request.userId = :userId", { userId })
        .andWhere("request.isApproved = :isApproved", { isApproved: false })
        .getMany();

      const requestSent = joinRequests.some(
        (request) => request.group.id === group.id
      );

      (group as any).requestSent = requestSent;

      (group as any).shareableLink = generateShareableLink({
        id: group.id,
        type: "group",
        typeName: group.industry,
      });
      // Check if current user is following
      const isFollowing = group.followers.some(
        (follower) => follower.id === userId
      );
      const isAdmin = group?.admins.some(
        (groupAdmin) => groupAdmin.admin.id === userId
      );

      const isCreator = group.creator?.id === userId;

      if (isAdmin || isCreator) {
        (group as any).pendingPostRequest = group.groupPostRequests.length;
        (group as any).pendingJoinRequest = group.groupJoinRequests.length;
      }
      // Remove unnecessary fields
      delete group.groupPostRequests;
      delete group.groupJoinRequests;

      // Add additional fields
      const responseData = {
        ...group,
        isFollowing,
        isAdmin,
        followerCount: group.followers.length,
      };

      res
        .status(HTTP_STATUS.OK)
        .json(handleResponse("Group retrieved successfully", responseData));
    } catch (error) {
      logger.error(
        `GroupController :: getGroupById :: ${(error as Error)?.message}`
      );
      return next(error);
    }
  }

  async getAllGroupsOfUser(
    req: ICustomRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = req.user?.id;
      const { page, take, skip, role } = req?.query;

      const skipNumber = Number(skip);
      const takeNumber = Number(take);

      let queryBuilder = this.groupRepo
        .createQueryBuilder("group")
        .leftJoinAndSelect("group.admins", "groupAdmin")
        .leftJoinAndSelect("groupAdmin.admin", "adminUser");

      if (role === "admin") {
        // Get pages where user is admin
        queryBuilder = queryBuilder.where("adminUser.id = :userId", { userId });
      } else if (role === "creator") {
        // Get pages created by user
        queryBuilder = queryBuilder
          .leftJoinAndSelect("group.creator", "creator")
          .where("creator.id = :userId", { userId });
      } else {
        // Default: get all pages where user is either creator or admin
        queryBuilder = queryBuilder
          .leftJoinAndSelect("group.creator", "creator")

          .where("creator.id = :userId OR adminUser.id = :userId", { userId });
      }

      // Add follower count
      queryBuilder = queryBuilder.leftJoinAndSelect(
        "group.followers",
        "follower"
      );

      // Get groups with pagination
      const [groups, totalItems] = await queryBuilder
        .orderBy("group.createdAt", "DESC")

        .skip(skipNumber)
        .take(takeNumber)
        .getManyAndCount();

      if (groups.length === 0) {
        res.status(HTTP_STATUS.OK).json(handleResponse("No groups found"));
        return next();
      }

      // Add follower count to each page
      const groupsWithCounts = groups.map((group) => ({
        ...group,
        followerCount: group.followers.length,
        isAdmin:
          group?.admins.some((groupAdmin) => groupAdmin.admin.id === userId) ||
          group.creator?.id === userId,
      }));

      res.status(HTTP_STATUS.OK).json(
        handleResponse("Groups retrieved successfully", {
          groups: groupsWithCounts,
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
        `GroupController :: getMyGroups :: ${(error as Error)?.message}`
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
        .leftJoinAndSelect("group.creator", "creator")
        .leftJoinAndSelect("group.admins", "admin")
        .where("group.id = :id", { id })
        .getOne();

      if (!group) {
        throw new ApiError("Group not found", HTTP_STATUS.NOT_FOUND);
      }
      const isCreator = group.creator?.id === userId;

      if (!isCreator) {
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

  async getGroups(
    req: ICustomRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { page, take, skip, type, industry } = req?.query;
      const userId = req.user?.id;
      const skipNumber = Number(skip);
      const takeNumber = Number(take);

      // Build query
      const queryBuilder = this.groupRepo
        .createQueryBuilder("group")
        .leftJoinAndSelect("group.creator", "creator")
        .leftJoinAndSelect("group.followers", "follower");

      // // Apply filters
      // if (type) {
      //   queryBuilder.andWhere("group.type = :type", { type });
      // }

      if (industry) {
        queryBuilder.andWhere("group.industry = :industry", { industry });
      }

      // Get groups with pagination
      const [groups, totalItems] = await queryBuilder
        .orderBy("group.createdAt", "DESC")
        .skip(skipNumber)
        .take(takeNumber)
        .getManyAndCount();

      if (groups.length === 0) {
        res.status(HTTP_STATUS.OK).json(handleResponse("No groups found"));
        return next();
      }
      for (const group of groups) {
        const joinRequests = await this.groupJoinRequestRepo
          .createQueryBuilder("request")
          .leftJoinAndSelect("request.group", "group")
          .where("request.userId = :userId", { userId })
          .andWhere("request.isApproved = :isApproved", { isApproved: false })
          .getMany();

        const isFollowing = group.followers.some(
          (follower) => follower.id === userId
        );

        const requestSent = joinRequests.some(
          (request) => request.group.id === group.id
        );

        (group as any).isFollowing = isFollowing;
        (group as any).requestSent = requestSent;

        (group as any).shareableLink = generateShareableLink({
          id: group.id,
          type: "group",
          typeName: group.industry,
        });
      }

      // Add follower count to each page
      const groupsWithCounts = groups.map((group) => ({
        ...group,
        followerCount: group.followers.length,
      }));

      res.status(HTTP_STATUS.OK).json(
        handleResponse("Groups retrieved successfully", {
          pages: groupsWithCounts,
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
        `GroupController :: getGroups :: ${(error as Error)?.message}`
      );
      return next(error);
    }
  }

  async followGroup(
    req: ICustomRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.user?.id;

      const user = await this.usersRepo.findOne({ where: { id: userId } });
      if (!user) throw new ApiError("User not found", HTTP_STATUS.NOT_FOUND);

      const group = await this.groupRepo.findOne({
        where: { id },
        relations: ["followers"],
      });
      if (!group) throw new ApiError("Group not found", HTTP_STATUS.NOT_FOUND);

      const existingRequest = await this.groupJoinRequestRepo
        .createQueryBuilder("request")
        .where("request.userId = :userId", { userId })
        .andWhere("request.groupId = :groupId", { groupId: id })
        .getOne();

      if (existingRequest) {
        group.followers = group.followers.filter(
          (follower) => follower.id !== userId
        );

        await this.groupRepo.save(group);
        //remove from groupJoinRequest
        await this.groupJoinRequestRepo.remove(existingRequest);

        if (existingRequest.isApproved) {
          res.status(HTTP_STATUS.OK).json(
            handleResponse("Group unfollowed successfully", {
              unfollowed: true,
            })
          );
          return next();
        } else {
          res.status(HTTP_STATUS.OK).json(
            handleResponse("Join request cancelled successfully", {
              unfollowed: true,
            })
          );
          return next();
        }
      } else {
        const request = this.groupJoinRequestRepo.create({
          user,
          group,
          userId,
          groupId: id,
          isApproved: false,
        });

        await this.groupJoinRequestRepo.save(request);

        // Send notification to group admins
        const groupAdmins = await this.groupAdminRepo
          .createQueryBuilder("groupAdmin")
          .leftJoinAndSelect("groupAdmin.admin", "adminUser") // Corrected join
          .where("groupAdmin.groupId = :groupId", { groupId: id })
          .getMany();

        const notificationPromises = groupAdmins.map(async (groupAdmin) => {
          const notification = {
            user: groupAdmin.admin.id,
            title: "Group Join Request",
            type: "group_join_request",
            message: `${user.firstName} ${user.lastName} has requested to join the group ${group.name}`,
            link: `/groups/${id}/join-requests`,
            metadata: {
              image: user.profileImage,
              event: NEW_GROUP_REQUEST,
              groupId: group.id,
              userId: user.id,
              groupName: group.name,
            },
          };

          const members = [groupAdmin.admin.id];
          emitEvent(req, NEW_GROUP_REQUEST, members, notification);

          await this.notificationModel.create(notification);
        });

        await Promise.all(notificationPromises);

        res.status(HTTP_STATUS.OK).json(
          handleResponse("Join request sent to group admins", {
            requestSent: true,
          })
        );
        return next();
      }
    } catch (error) {
      logger.error(`GroupController :: followGroup :: ${error.message}`);
      return next(error);
    }
  }

  async getPendingRequests(
    req: ICustomRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { groupId } = req.params;
      const currentUserId = req.user?.id;

      const group = await this.groupRepo
        .createQueryBuilder("group")
        .leftJoinAndSelect("group.creator", "creator")
        .leftJoinAndSelect("group.admins", "groupAdmin")
        .leftJoinAndSelect("groupAdmin.admin", "adminUser")
        .where("group.id = :id", { id: groupId })
        .getOne();

      if (!group) {
        throw new ApiError("Group not found", HTTP_STATUS.NOT_FOUND);
      }

      const isAdmin = group?.admins.some(
        (groupAdmin) => groupAdmin.admin.id === currentUserId
      );

      const isCreator = group.creator?.id === currentUserId;

      if (!isAdmin && !isCreator) {
        throw new ApiError(
          "You are not authorized to view pending requests",
          HTTP_STATUS.FORBIDDEN
        );
      }

      const pendingRequests = await this.groupJoinRequestRepo.find({
        where: {
          groupId,
          isApproved: false,
        },
        relations: ["user", "group"],
      });

      res.status(HTTP_STATUS.OK).json(
        handleResponse("Pending group join requests fetched successfully", {
          pendingRequests,
        })
      );
    } catch (error) {
      logger.error(`GroupController :: getPendingRequests :: ${error.message}`);
      return next(error);
    }
  }

  async approveGroupJoinRequest(
    req: ICustomRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { requestId } = req.params;
      const { action } = req.body;
      const request = await this.groupJoinRequestRepo.findOne({
        where: { id: requestId },
        relations: ["group", "user"],
      });

      if (!request || request.isApproved)
        throw new ApiError("Invalid or already approved request", 400);

      if (action == "accept") {
        request.isApproved = true;
        request.status = GroupRequestStatus.APPROVED;
        await this.groupJoinRequestRepo.save(request);

        // Add to followers
        const group = await this.groupRepo.findOne({
          where: { id: request.groupId },
          relations: ["followers"],
        });

        group.followers.push(request.user);
        await this.groupRepo.save(group);

        const notification = {
          user: request.user.id,
          title: "Group Join Request Approved",
          type: "info",
          message: `Your request to join the group ${request.group.name} has been approved.`,
          link: `/groups/${request.group.id}`,
          metadata: {
            event: GROUP_REQUEST_UPDATED,
            image: request.group.logoUrl,
            groupId: request.group.id,
            groupName: request.group.name,
          },
        };
        const members = [request.user.id];
        await Promise.all([
          this.notificationModel.create(notification),
          emitEvent(req, GROUP_REQUEST_UPDATED, members, notification),
        ]);

        res
          .status(HTTP_STATUS.OK)
          .json(handleResponse("Join request approved", { approved: true }));
      } else if (action == "reject") {
        const notification = {
          user: request.user.id,
          title: "Group Join Request Rejected",
          type: "info",
          message: `Your request to join the group ${request.group.name} has been rejected.`,
          link: `/groups/${request.group.id}`,
          metadata: {
            event: GROUP_REQUEST_UPDATED,
            image: request.group.logoUrl,
            groupId: request.group.id,
            groupName: request.group.name,
          },
        };
        const members = [request.user.id];
        await Promise.all([
          this.notificationModel.create(notification),
          emitEvent(req, GROUP_REQUEST_UPDATED, members, notification),
        ]);
        await this.groupJoinRequestRepo.remove(request);

        res
          .status(HTTP_STATUS.OK)
          .json(handleResponse("Join request rejected", { approved: false }));
      }
      return next();
    } catch (error) {
      logger.error(
        `GroupController :: approveGroupJoinRequest :: ${error.message}`
      );
      return next(error);
    }
  }

  async getFollowedGroups(
    req: ICustomRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = req.user?.id;
      const { page, take, skip } = req?.query;

      const skipNumber = Number(skip);
      const takeNumber = Number(take);

      // Get pages that the user follows
      const queryBuilder = this.groupRepo
        .createQueryBuilder("group")
        .leftJoinAndSelect("group.followers", "follower")
        .leftJoinAndSelect("group.creator", "creator")
        .where("follower.id = :userId", { userId });

      // Get pages with pagination
      const [groups, totalItems] = await queryBuilder
        .orderBy("group.createdAt", "DESC")
        .skip(skipNumber)
        .take(takeNumber)
        .getManyAndCount();

      if (groups.length === 0) {
        res
          .status(HTTP_STATUS.OK)
          .json(handleResponse("No followed groups found"));
        return next();
      }

      // Add follower count to each page
      const groupsWithCounts = groups.map((group) => ({
        ...group,
        followerCount: group.followers.length,
        isAdmin: group.creator?.id === userId,
      }));

      res.status(HTTP_STATUS.OK).json(
        handleResponse("Followed groups retrieved successfully", {
          groups: groupsWithCounts,
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
        `GroupController :: getFollowedGroups :: ${(error as Error)?.message}`
      );
      return next(error);
    }
  }

  async fetchAllPendingPosts(
    req: ICustomRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { groupId } = req.params;
      const currentUserId = req.user?.id;
      const group = await this.groupRepo
        .createQueryBuilder("group")
        .leftJoinAndSelect("group.creator", "creator")
        .leftJoinAndSelect("group.admins", "groupAdmin")
        .leftJoinAndSelect("groupAdmin.admin", "adminUser")
        .where("group.id = :id", { id: groupId })
        .getOne();

      if (!group) {
        throw new ApiError("Group not found", HTTP_STATUS.NOT_FOUND);
      }

      const isAdmin = group?.admins.some(
        (groupAdmin) => groupAdmin.admin.id === currentUserId
      );

      const isCreator = group.creator?.id === currentUserId;

      if (!isAdmin && !isCreator) {
        throw new ApiError(
          "You are not authorized to view pending requests",
          HTTP_STATUS.FORBIDDEN
        );
      }

      const pendingRequests = await this.groupPostRequestRepo
        .createQueryBuilder("request")
        .leftJoinAndSelect("request.user", "user")
        .leftJoinAndSelect("request.post", "post")
        .leftJoinAndSelect("post.poll", "poll")
        .leftJoinAndSelect("request.group", "group")
        .where("request.isApproved = :isApproved", { isApproved: false })
        .andWhere("request.group = :groupId", { groupId: group.id })
        .andWhere("request.status = :status", {
          status: PostRequestStatus.PENDING,
        })
        .orderBy("request.createdAt", "DESC")
        .getMany();

      res
        .status(HTTP_STATUS.OK)
        .json(
          handleResponse(
            "Fetched all pending group post requests",
            pendingRequests
          )
        );
    } catch (error) {
      logger.error(
        `GroupController :: fetchAllPendingPosts :: ${
          (error as Error)?.message
        }`
      );
      return next(error);
    }
  }

  async approveOrRejectPost(
    req: ICustomRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { requestId } = req.params;
      const { action, rejectionReason } = req.body;
      const currentUserId = req.user?.id;

      const groupPostRequest = await this.groupPostRequestRepo.findOne({
        where: { id: requestId },
        relations: ["group", "group.admins", "group.creator", "post", "user"],
      });

      if (!groupPostRequest) {
        throw new ApiError(
          "Group post request not found",
          HTTP_STATUS.NOT_FOUND
        );
      }

      const group = groupPostRequest.group;
      const isAdmin = group.admins.some((admin) => admin.id === currentUserId);
      const isCreator = group.creator?.id === currentUserId;

      if (!isAdmin && !isCreator) {
        throw new ApiError(
          "You are not authorized to perform this action",
          HTTP_STATUS.FORBIDDEN
        );
      }

      if (groupPostRequest.isApproved) {
        throw new ApiError(
          "This post request is already approved",
          HTTP_STATUS.BAD_REQUEST
        );
      }

      if (action === "approve") {
        groupPostRequest.isApproved = true;
        groupPostRequest.rejectionReason = null;
        groupPostRequest.status = PostRequestStatus.APPROVED;

        const notification = {
          user: groupPostRequest.user.id,
          title: "Group Post Request Approved",
          type: "info",
          message: `Your request to post in the group ${groupPostRequest.group.name} has been approved.`,
          link: `/groups/${groupPostRequest.group.id}`,
          metadata: {
            event: GROUP_POST_REQUEST_UPDATED,
            image: group.logoUrl,
            postId: groupPostRequest.post.id,
            groupId: groupPostRequest.group.id,
          },
        };
        const members = [groupPostRequest.user.id];
        await Promise.all([
          this.notificationModel.create(notification),
          emitEvent(req, GROUP_POST_REQUEST_UPDATED, members, notification),
        ]);
      } else if (action === "reject") {
        if (!rejectionReason) {
          throw new ApiError(
            "Rejection reason is required",
            HTTP_STATUS.BAD_REQUEST
          );
        }
        groupPostRequest.rejectionReason = rejectionReason;
        groupPostRequest.isApproved = false;
        groupPostRequest.status = PostRequestStatus.REJECTED;
        const notification = {
          user: groupPostRequest.user.id,
          title: "Group Post Request Rejected",
          type: "info",
          message: `Your request to post in the group ${groupPostRequest.group.name} has been rejected.`,
          link: `/groups/${groupPostRequest.group.id}`,
          metadata: {
            image: group.logoUrl,
            event: GROUP_POST_REQUEST_UPDATED,
            postId: groupPostRequest.post.id,
            groupId: groupPostRequest.group.id,
          },
        };
        const members = [groupPostRequest.user.id];
        await Promise.all([
          this.notificationModel.create(notification),
          emitEvent(req, GROUP_POST_REQUEST_UPDATED, members, notification),
        ]);
      } else {
        throw new ApiError(
          "Invalid action. Must be 'approve' or 'reject'",
          HTTP_STATUS.BAD_REQUEST
        );
      }

      await this.groupPostRequestRepo.save(groupPostRequest);

      res
        .status(HTTP_STATUS.OK)
        .json(
          handleResponse(
            `Post request has been ${action}d successfully`,
            groupPostRequest
          )
        );
    } catch (error) {
      logger.error(
        `GroupController :: approveOrRejectPost :: ${(error as Error)?.message}`
      );
      return next(error);
    }
  }

  async addAdmin(
    req: ICustomRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { id } = req.params;
      const { userId } = req.body;
      const currentUserId = req.user?.id;

      // Get the page
      const group = await this.groupRepo
        .createQueryBuilder("group")
        .leftJoinAndSelect("group.admins", "groupAdmin")
        .leftJoinAndSelect("groupAdmin.admin", "adminUser")
        .leftJoinAndSelect("group.creator", "creator")
        .where("group.id = :id", { id })
        .getOne();

      if (!group) {
        throw new ApiError("Group not found", HTTP_STATUS.NOT_FOUND);
      }
      const currentUser = await this.usersRepo.findOne({
        where: { id: currentUserId },
      });

      // Check if current user is admin
      const isAdmin = group?.admins.some(
        (groupAdmin) => groupAdmin.admin.id === currentUserId
      );
      if (!isAdmin && group.creator.id !== currentUserId) {
        throw new ApiError(
          "You are not authorized to add admins to this group",
          HTTP_STATUS.FORBIDDEN
        );
      }

      // Get user to be added as admin
      const newAdmin = await this.usersRepo.findOne({ where: { id: userId } });
      if (!newAdmin) {
        throw new ApiError("User not found", HTTP_STATUS.NOT_FOUND);
      }

      // Check if user is already an admin
      const isAlreadyAdmin = group?.admins.some(
        (groupAdmin) => groupAdmin.admin.id === userId
      );
      if (isAlreadyAdmin) {
        throw new ApiError(
          "User is already an admin of this group",
          HTTP_STATUS.BAD_REQUEST
        );
      }

      // Add the user as admin
      const groupAdmin = this.groupAdminRepo.create({
        group: group,
        groupId: group.id,
        admin: newAdmin,
        adminId: newAdmin.id,
        createdBy: currentUser,
        createdById: currentUser.id,
      });
      await this.groupAdminRepo.save(groupAdmin);

      // await this.groupRepo.save(group);

      // Create notification for the new admin
      try {
        await this.notificationModel.create({
          user: newAdmin.id,
          title: "New Page Admin Role",
          message: `You have been made an admin of the group: ${group.name}`,
          type: "info",
          metadata: {
            groupId: group.id,
            image: group.logoUrl,
          },
        });
      } catch (error) {
        logger.error(`Failed to create notification: ${error.message}`);
        // Don't fail the entire request if notification creation fails
      }

      res
        .status(HTTP_STATUS.OK)
        .json(handleResponse("Admin added successfully", group));
    } catch (error) {
      logger.error(
        `GroupController :: addAdmin :: ${(error as Error)?.message}`
      );
      return next(error);
    }
  }

  async getFollowRequestedGroups(
    req: ICustomRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = req.user?.id;

      // Find all join requests sent by the user
      const joinRequests = await this.groupJoinRequestRepo
        .createQueryBuilder("request")
        .leftJoinAndSelect("request.group", "group")
        .where("request.userId = :userId", { userId })
        .andWhere("request.isApproved = :isApproved", { isApproved: false })
        .getMany();

      const requestedGroups = joinRequests.map((req) => ({
        requestId: req.id,
        group: req.group,
        isApproved: req.isApproved,
        requestedAt: req.createdAt,
      }));

      res
        .status(HTTP_STATUS.OK)
        .json(
          handleResponse(
            "Requested groups fetched successfully",
            requestedGroups
          )
        );
      next();
    } catch (error) {
      logger.error(
        `GroupController :: getFollowRequestedGroups :: ${error.message}`
      );
      return next(error);
    }
  }

  async removeAdmin(
    req: ICustomRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { id } = req.params;
      const { userId } = req.body;
      const currentUserId = req.user?.id;

      // Get the group with creator and admins
      const group = await this.groupRepo
        .createQueryBuilder("group")
        .leftJoinAndSelect("group.admins", "groupAdmin")
        .leftJoinAndSelect("groupAdmin.admin", "adminUser")
        .leftJoinAndSelect("group.creator", "creator")
        .where("group.id = :id", { id })
        .getOne();

      if (!group) {
        throw new ApiError("Group not found", HTTP_STATUS.NOT_FOUND);
      }

      // Only creator can remove admins
      if (group.creator.id !== currentUserId) {
        throw new ApiError(
          "Only the group creator can remove admins",
          HTTP_STATUS.FORBIDDEN
        );
      }

      // Cannot remove creator as admin
      if (userId === group.creator.id) {
        throw new ApiError(
          "Cannot remove the page creator as admin",
          HTTP_STATUS.BAD_REQUEST
        );
      }

      // Find the GroupAdmin entry for the given user
      const adminToRemove = group.admins.find((ga) => ga.admin.id === userId);

      if (!adminToRemove) {
        throw new ApiError(
          "User is not an admin of this group",
          HTTP_STATUS.BAD_REQUEST
        );
      }

      // Remove the GroupAdmin entry
      await this.groupAdminRepo.delete(adminToRemove.id);

      // Notify the user
      const removedAdmin = await this.usersRepo.findOne({
        where: { id: userId },
      });

      if (removedAdmin) {
        try {
          await this.notificationModel.create({
            user: removedAdmin.id,
            title: "Group Admin Role Removed",
            message: `You are no longer an admin of the group: ${group.name}`,
            type: "info",
            metadata: {
              groupId: group.id,
              image: group.logoUrl,
            },
          });
        } catch (error) {
          logger.error(`Failed to create notification: ${error.message}`);
          // Don't fail the entire request if notification creation fails
        }
      }

      res
        .status(HTTP_STATUS.OK)
        .json(handleResponse("Admin removed successfully", group));
    } catch (error) {
      logger.error(
        `GroupController :: removeAdmin :: ${(error as Error)?.message}`
      );
      return next(error);
    }
  }
}
