import { NextFunction, Response } from "express";
import { OrganizationType, Page, PageSize, User } from "../../entity";
import { ICustomRequest, IFileObject, IFileRequest } from "../../interfaces";
import { Repository } from "typeorm";
import fs from "fs";
import path from "path";
import { ApiError } from "../../errors";
import { CLOUD_FOLDERS, HTTP_STATUS } from "../../constants";
import { commonHelper } from "../../helpers";
import { handleResponse, logger } from "../../utils";
import { uploadService } from "../../services";
import { Notification } from "../../models";

export class PageController {
  constructor(
    private usersRepo: Repository<User>,
    private pageRepo: Repository<Page>,
    private notificationModel: typeof Notification
  ) {}

  async createPage(
    req: ICustomRequest,
    file: IFileRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const {
        name,
        type,
        address,
        locationCountry,
        branchesCountries,
        organizationSize,
        organizationType,
        industry,
        website,
        tagline,
        // Production industry fields
        productionDescription,
        energyConsumption,
        certifications,
        costDetails,
        // Transportation industry fields
        transportationDescription,
        fleetSize,
        operatingRange,
        transportationCostDetails,
        // Storage industry fields

        storageCapacity,
        storageType,

        // Other industry-specific fields
        otherDescription,
        otherCostDetails,
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
      const newPage = new Page();
      newPage.name = name;
      newPage.type = type;
      newPage.address = address;
      newPage.locationCountry = locationCountry;
      newPage.branchesCountries = Array.isArray(branchesCountries)
        ? branchesCountries
        : branchesCountries
        ? [branchesCountries]
        : [];
      newPage.organizationSize =
        PageSize[organizationSize as keyof typeof PageSize];

      newPage.organizationType =
        OrganizationType[organizationType as keyof typeof OrganizationType];
      newPage.industry = industry;
      newPage.website = website;
      newPage.tagline = tagline;
      newPage.creator = user;
      newPage.creatorId = user.id;

      // Set logo and cover image if uploaded
      if (logoUrls.length > 0) {
        newPage.logoUrl = logoUrls[0].url;
        newPage.logoPublicId = logoUrls[0].public_id;
      }

      if (coverUrls.length > 0) {
        newPage.coverImageUrl = coverUrls[0].url;
        newPage.coverImagePublicId = coverUrls[0].public_id;
      }

      // Set industry-specific fields based on industry type
      if (industry === "PRODUCTION") {
        newPage.productionDescription = productionDescription;
        newPage.energyConsumption = energyConsumption;
        newPage.certifications = certifications;
        newPage.costDetails = costDetails;
      } else if (industry === "TRANSPORTATION") {
        newPage.transportationDescription = transportationDescription;
        newPage.fleetSize = fleetSize ? parseInt(fleetSize) : null;
        newPage.operatingRange = operatingRange;
        newPage.transportationCostDetails = transportationCostDetails;
      } else if (industry === "STORAGE") {
        newPage.storageCapacity = storageCapacity;
        newPage.storageTemperature = storageType;
      } else if (industry === "OTHER") {
        newPage.otherDescription = otherDescription;
        newPage.otherCostDetails = otherCostDetails;
      }

      // Set creator as admin
      newPage.admins = [user];

      // Save page
      const savedPage = await this.pageRepo.save(newPage);

      // Clean up uploaded files
      const files = fs.readdirSync(uploadsPath);
      files.forEach((file) => {
        const filePath = path.join(uploadsPath, file);
        fs.unlinkSync(filePath);
      });

      res
        .status(HTTP_STATUS.CREATED)
        .json(handleResponse("Page created successfully", savedPage));
    } catch (error) {
      // Clean up any uploaded files in case of error
      const uploadsPath = path.join(process.cwd(), "uploads");
      const files = fs.readdirSync(uploadsPath);
      files.forEach((file) => {
        const filePath = path.join(uploadsPath, file);
        fs.unlinkSync(filePath);
      });

      logger.error(
        `PageController :: createPage :: ${(error as Error)?.message}`
      );
      return next(error);
    }
  }

  async updatePage(
    req: ICustomRequest,
    file: IFileRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { id } = req.params;
      const {
        name,
        type,
        address,
        locationCountry,
        branchesCountries,
        organizationSize,
        organizationType,
        industry,
        website,
        tagline,
        // Production industry fields
        productionDescription,
        energyConsumption,
        certifications,
        costDetails,
        // Transportation industry fields
        transportationDescription,
        fleetSize,
        operatingRange,
        transportationCostDetails,
        // Storage industry fields
        storageCapacity,
        storageTemperature,
        //other industry-specific fields can be added here
        otherDescription,
        otherCostDetails,
      } = req.body;

      const userId = req.user?.id;

      // Get the page
      const page = await this.pageRepo
        .createQueryBuilder("page")
        .leftJoinAndSelect("page.admins", "admin")
        .where("page.id = :id", { id })
        .getOne();

      if (!page) {
        throw new ApiError("Page not found", HTTP_STATUS.NOT_FOUND);
      }

      // Check if user is an admin
      const isAdmin = page.admins.some((admin) => admin.id === userId);
      if (!isAdmin) {
        throw new ApiError(
          "You are not authorized to update this page",
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

      const folderName = `${CLOUD_FOLDERS.PAGE}/${page.name.replace(
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
          if (page.logoPublicId) {
            await uploadService.deleteFile(page.logoPublicId);
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
          if (page.coverImagePublicId) {
            await uploadService.deleteFile(page.coverImagePublicId);
          }
        }
      }

      // Update page fields
      if (name) page.name = name;
      if (type) page.type = type;
      if (address) page.address = address;
      if (locationCountry) page.locationCountry = locationCountry;
      if (branchesCountries) {
        page.branchesCountries = Array.isArray(branchesCountries)
          ? branchesCountries
          : [branchesCountries];
      }
      if (organizationSize)
        page.organizationSize =
          PageSize[organizationSize as keyof typeof PageSize];
      if (organizationType)
        page.organizationType =
          OrganizationType[organizationType as keyof typeof OrganizationType];
      if (industry) page.industry = industry;
      if (website) page.website = website;
      if (tagline) page.tagline = tagline;

      // Update logo and cover if uploaded
      if (logoUrl) page.logoUrl = logoUrl;
      if (logoPublicId) page.logoPublicId = logoPublicId;
      if (coverImageUrl) page.coverImageUrl = coverImageUrl;
      if (coverImagePublicId) page.coverImagePublicId = coverImagePublicId;

      // Update industry-specific fields based on industry type
      if (industry === "PRODUCTION" || page.industry === "PRODUCTION") {
        page.productionDescription =
          productionDescription || page.productionDescription;
        page.energyConsumption = energyConsumption || page.energyConsumption;
        page.certifications = certifications || page.certifications;
        page.costDetails = costDetails || page.costDetails;
      } else if (
        industry === "TRANSPORTATION" ||
        page.industry === "TRANSPORTATION"
      ) {
        page.transportationDescription =
          transportationDescription || page.transportationDescription;
        page.fleetSize = fleetSize ? parseInt(fleetSize) : page.fleetSize;
        page.operatingRange = operatingRange || page.operatingRange;
        page.transportationCostDetails =
          transportationCostDetails || page.transportationCostDetails;
      } else if (industry === "STORAGE" || page.industry === "STORAGE") {
        page.storageCapacity = storageCapacity || page.storageCapacity;
        page.storageTemperature = storageTemperature || page.storageTemperature;
      } else if (industry === "OTHER" || page.industry === "OTHER") {
        page.otherDescription = otherDescription || page.otherDescription;
        page.otherCostDetails = otherCostDetails || page.otherCostDetails;
      }

      // Save updated page
      const updatedPage = await this.pageRepo.save(page);

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

  async getPageById(
    req: ICustomRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { id } = req.params;

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
    } catch (error) {
      logger.error(
        `PageController :: getPageById :: ${(error as Error)?.message}`
      );
      return next(error);
    }
  }

  async getPages(
    req: ICustomRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { page, take, skip, type, industry } = req?.query;

      const skipNumber = Number(skip);
      const takeNumber = Number(take);

      // Build query
      const queryBuilder = this.pageRepo
        .createQueryBuilder("page")
        .leftJoinAndSelect("page.creator", "creator")
        .leftJoinAndSelect("page.followers", "follower");

      // Apply filters
      if (type) {
        queryBuilder.andWhere("page.type = :type", { type });
      }

      if (industry) {
        queryBuilder.andWhere("page.industry = :industry", { industry });
      }

      // Get pages with pagination
      const [pages, totalItems] = await queryBuilder
        .orderBy("page.createdAt", "DESC")
        .skip(skipNumber)
        .take(takeNumber)
        .getManyAndCount();

      if (pages.length === 0) {
        res.status(HTTP_STATUS.OK).json(handleResponse("No pages found"));
        return next();
      }

      // Add follower count to each page
      const pagesWithCounts = pages.map((page) => ({
        ...page,
        followerCount: page.followers.length,
      }));

      res.status(HTTP_STATUS.OK).json(
        handleResponse("Pages retrieved successfully", {
          pages: pagesWithCounts,
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
        `PageController :: getPages :: ${(error as Error)?.message}`
      );
      return next(error);
    }
  }

  async followPage(
    req: ICustomRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.user?.id;
      const user = await this.usersRepo.findOne({ where: { id: userId } });

      if (!user) {
        throw new ApiError("User not found", HTTP_STATUS.NOT_FOUND);
      }

      const page = await this.pageRepo
        .createQueryBuilder("page")
        .leftJoinAndSelect("page.followers", "follower")
        .leftJoinAndSelect("page.creator", "creator")
        .where("page.id = :id", { id })
        .getOne();

      if (!page) {
        throw new ApiError("Page not found", HTTP_STATUS.NOT_FOUND);
      }

      // Check if user is already following
      const isFollowing = page.followers.some(
        (follower) => follower.id === userId
      );

      if (isFollowing) {
        // Unfollow
        page.followers = page.followers.filter(
          (follower) => follower.id !== userId
        );
        await this.pageRepo.save(page);

        res
          .status(HTTP_STATUS.OK)
          .json(
            handleResponse("Page unfollowed successfully", { following: false })
          );
      } else {
        // Follow
        page.followers.push(user);
        await this.pageRepo.save(page);

        // Create notification for page creator
        if (page.creator.id !== userId) {
          try {
            await this.notificationModel.create({
              user: page.creator.userChatId,
              title: "New Page Follower",
              message: `${user.firstName} ${user.lastName} followed your page: ${page.name}`,
              type: "info",
              metadata: {
                pageId: page.id,
                followerUserId: userId,
              },
            });
          } catch (error) {
            logger.error(`Failed to create notification: ${error.message}`);
            // Don't fail the entire request if notification creation fails
          }
        }

        res
          .status(HTTP_STATUS.OK)
          .json(
            handleResponse("Page followed successfully", { following: true })
          );
      }
    } catch (error) {
      logger.error(
        `PageController :: followPage :: ${(error as Error)?.message}`
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
      const page = await this.pageRepo
        .createQueryBuilder("page")
        .leftJoinAndSelect("page.admins", "admin")
        .leftJoinAndSelect("page.creator", "creator")
        .where("page.id = :id", { id })
        .getOne();

      if (!page) {
        throw new ApiError("Page not found", HTTP_STATUS.NOT_FOUND);
      }

      // Check if current user is admin
      const isAdmin = page.admins.some((admin) => admin.id === currentUserId);
      if (!isAdmin && page.creator.id !== currentUserId) {
        throw new ApiError(
          "You are not authorized to add admins to this page",
          HTTP_STATUS.FORBIDDEN
        );
      }

      // Get user to be added as admin
      const newAdmin = await this.usersRepo.findOne({ where: { id: userId } });
      if (!newAdmin) {
        throw new ApiError("User not found", HTTP_STATUS.NOT_FOUND);
      }

      // Check if user is already an admin
      const isAlreadyAdmin = page.admins.some((admin) => admin.id === userId);
      if (isAlreadyAdmin) {
        throw new ApiError(
          "User is already an admin of this page",
          HTTP_STATUS.BAD_REQUEST
        );
      }

      // Add the user as admin
      page.admins.push(newAdmin);
      await this.pageRepo.save(page);

      // Create notification for the new admin
      try {
        await this.notificationModel.create({
          user: newAdmin.userChatId,
          title: "New Page Admin Role",
          message: `You have been made an admin of the page: ${page.name}`,
          type: "info",
          metadata: {
            pageId: page.id,
          },
        });
      } catch (error) {
        logger.error(`Failed to create notification: ${error.message}`);
        // Don't fail the entire request if notification creation fails
      }

      res
        .status(HTTP_STATUS.OK)
        .json(handleResponse("Admin added successfully", page));
    } catch (error) {
      logger.error(
        `PageController :: addAdmin :: ${(error as Error)?.message}`
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

      // Get the page
      const page = await this.pageRepo
        .createQueryBuilder("page")
        .leftJoinAndSelect("page.admins", "admin")
        .leftJoinAndSelect("page.creator", "creator")
        .where("page.id = :id", { id })
        .getOne();

      if (!page) {
        throw new ApiError("Page not found", HTTP_STATUS.NOT_FOUND);
      }

      // Only creator can remove admins
      if (page.creator.id !== currentUserId) {
        throw new ApiError(
          "Only the page creator can remove admins",
          HTTP_STATUS.FORBIDDEN
        );
      }

      // Cannot remove creator as admin
      if (userId === page.creator.id) {
        throw new ApiError(
          "Cannot remove the page creator as admin",
          HTTP_STATUS.BAD_REQUEST
        );
      }

      // Check if user is an admin
      const isAdmin = page.admins.some((admin) => admin.id === userId);
      if (!isAdmin) {
        throw new ApiError(
          "User is not an admin of this page",
          HTTP_STATUS.BAD_REQUEST
        );
      }

      // Remove the user from admins
      page.admins = page.admins.filter((admin) => admin.id !== userId);
      await this.pageRepo.save(page);

      // Find the removed admin user for notification
      const removedAdmin = await this.usersRepo.findOne({
        where: { id: userId },
      });
      if (removedAdmin) {
        try {
          await this.notificationModel.create({
            user: removedAdmin.userChatId,
            title: "Page Admin Role Removed",
            message: `You are no longer an admin of the page: ${page.name}`,
            type: "info",
            metadata: {
              pageId: page.id,
            },
          });
        } catch (error) {
          logger.error(`Failed to create notification: ${error.message}`);
          // Don't fail the entire request if notification creation fails
        }
      }

      res
        .status(HTTP_STATUS.OK)
        .json(handleResponse("Admin removed successfully", page));
    } catch (error) {
      logger.error(
        `PageController :: removeAdmin :: ${(error as Error)?.message}`
      );
      return next(error);
    }
  }

  async deletePage(
    req: ICustomRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.user?.id;

      // Get the page
      const page = await this.pageRepo
        .createQueryBuilder("page")
        .leftJoinAndSelect("page.creator", "creator")
        .where("page.id = :id", { id })
        .getOne();

      if (!page) {
        throw new ApiError("Page not found", HTTP_STATUS.NOT_FOUND);
      }

      // Only creator can delete the page
      if (page.creator.id !== userId) {
        throw new ApiError(
          "Only the page creator can delete this page",
          HTTP_STATUS.FORBIDDEN
        );
      }

      // Delete logo and cover image from cloud storage
      if (page.logoPublicId) {
        await uploadService.deleteFile(page.logoPublicId);
      }
      if (page.coverImagePublicId) {
        await uploadService.deleteFile(page.coverImagePublicId);
      }

      // Delete page
      await this.pageRepo.remove(page);

      res
        .status(HTTP_STATUS.OK)
        .json(handleResponse("Page deleted successfully"));
    } catch (error) {
      logger.error(
        `PageController :: deletePage :: ${(error as Error)?.message}`
      );
      return next(error);
    }
  }

  async getMyPages(
    req: ICustomRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = req.user?.id;
      const { page, take, skip, role } = req?.query;

      const skipNumber = Number(skip);
      const takeNumber = Number(take);

      let queryBuilder = this.pageRepo.createQueryBuilder("page");

      if (role === "admin") {
        // Get pages where user is admin
        queryBuilder = queryBuilder
          .leftJoinAndSelect("page.admins", "admin")
          .where("admin.id = :userId", { userId });
      } else if (role === "creator") {
        // Get pages created by user
        queryBuilder = queryBuilder
          .leftJoinAndSelect("page.creator", "creator")
          .where("creator.id = :userId", { userId });
      } else {
        // Default: get all pages where user is either creator or admin
        queryBuilder = queryBuilder
          .leftJoinAndSelect("page.creator", "creator")
          .leftJoinAndSelect("page.admins", "admin")
          .where("creator.id = :userId OR admin.id = :userId", { userId });
      }

      // Add follower count
      queryBuilder = queryBuilder.leftJoinAndSelect(
        "page.followers",
        "follower"
      );

      // Get pages with pagination
      const [pages, totalItems] = await queryBuilder
        .orderBy("page.createdAt", "DESC")
        .skip(skipNumber)
        .take(takeNumber)
        .getManyAndCount();

      if (pages.length === 0) {
        res.status(HTTP_STATUS.OK).json(handleResponse("No pages found"));
        return next();
      }

      // Add follower count to each page
      const pagesWithCounts = pages.map((page) => ({
        ...page,
        followerCount: page.followers.length,
        isAdmin:
          page.admins?.some((admin) => admin.id === userId) ||
          page.creator?.id === userId,
      }));

      res.status(HTTP_STATUS.OK).json(
        handleResponse("Pages retrieved successfully", {
          pages: pagesWithCounts,
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
        `PageController :: getMyPages :: ${(error as Error)?.message}`
      );
      return next(error);
    }
  }

  async getFollowedPages(
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
      const queryBuilder = this.pageRepo
        .createQueryBuilder("page")
        .leftJoinAndSelect("page.followers", "follower")
        .leftJoinAndSelect("page.creator", "creator")
        .where("follower.id = :userId", { userId });

      // Get pages with pagination
      const [pages, totalItems] = await queryBuilder
        .orderBy("page.createdAt", "DESC")
        .skip(skipNumber)
        .take(takeNumber)
        .getManyAndCount();

      if (pages.length === 0) {
        res
          .status(HTTP_STATUS.OK)
          .json(handleResponse("No followed pages found"));
        return next();
      }

      // Add follower count to each page
      const pagesWithCounts = pages.map((page) => ({
        ...page,
        followerCount: page.followers.length,
        isAdmin: page.creator?.id === userId,
      }));

      res.status(HTTP_STATUS.OK).json(
        handleResponse("Followed pages retrieved successfully", {
          pages: pagesWithCounts,
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
        `PageController :: getFollowedPages :: ${(error as Error)?.message}`
      );
      return next(error);
    }
  }
}
