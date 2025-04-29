import { Router } from "express";
import { PageController } from "../../controllers";
import { Page, User } from "../../entity";
import { AppDataSource } from "../../typeorm.config";
import {
    checkJwt,
    handleMultipleFiles,
    setPagination,
    validateRoles,
} from "../../middleware";
import { Notification } from "../../models";
import { FILE_FIELDS, ROLES } from "../../constants";
import { PageValidation, validate } from "../../validations";

const router = Router();
const userRepository = AppDataSource.getRepository(User);
const pageRepository = AppDataSource.getRepository(Page);

const pageController = new PageController(
    userRepository,
    pageRepository,
    Notification
);

/**
 * @swagger
 * /page:
 *   post:
 *     summary: Create a new page
 *     description: Creates a new page with the provided details. Different fields are required based on industry type.
 *     security:
 *       - bearerAuth: []
 *     tags:
 *       - Page
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - type
 *               - address
 *               - organizationSize
 *               - industry
 *             properties:
 *               name:
 *                 type: string
 *                 description: Name of the page
 *               type:
 *                 type: string
 *                 enum: [COMPANY, EDUCATIONAL_INSTITUTE]
 *                 description: Type of the page
 *               address:
 *                 type: string
 *                 description: Address of the organization
 *               locationCountry:
 *                 type: string
 *                 description: Headquarters/main location
 *               branchesCountries:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Countries where the organization has branches
 *               organizationSize:
 *                 type: string
 *                 enum: [ZERO_TO_ONE, TWO_TO_TEN, ELEVEN_TO_FIFTY, FIFTY_ONE_TO_TWO_HUNDRED]
 *                 description: Size of the organization
 *               organizationType:
 *                 type: string
 *                 enum: [PUBLICLY_HELD, PRIVATELY_HELD, NON_PROFIT]
 *               industry:
 *                 type: string
 *                 enum: [PRODUCTION, TRANSPORTATION, STORAGE, TECHNOLOGY, FINANCE, EDUCATION, HEALTHCARE, RETAIL, OTHER]
 *                 description: Industry type of the organization
 *               website:
 *                 type: string
 *                 description: Website URL of the organization
 *               tagline:
 *                 type: string
 *                 description: Tagline or slogan of the organization
 *               logo:
 *                 type: string
 *                 format: binary
 *                 description: Logo image for the page
 *               cover:
 *                 type: string
 *                 format: binary
 *                 description: Cover image for the page
 *               # Production industry fields
 *               productionDescription:
 *                 type: string
 *                 description: Description of what is being produced (required for PRODUCTION industry)
 *               energyConsumption:
 *                 type: string
 *                 description: Details about energy consumption (required for PRODUCTION industry)
 *               certifications:
 *                 type: string
 *                 description: Information about certifications
 *               costDetails:
 *                 type: string
 *                 description: Cost details
 *               # Transportation industry fields
 *               transportationDescription:
 *                 type: string
 *                 description: Description of transportation services (required for TRANSPORTATION industry)
 *               fleetSize:
 *                 type: integer
 *                 description: Size of the transportation fleet (required for TRANSPORTATION industry)
 *               operatingRange:
 *                 type: string
 *                 description: Range of operation (required for TRANSPORTATION industry)
 *               transportationCostDetails:
 *                 type: string
 *                 description: Transportation cost details
 *               # Storage industry fields
 *               storageCapacity:
 *                 type: string
 *                 description: Storage capacity (required for STORAGE industry)
 *               storageTemperature:
 *                 type: string
 *                 description: Temperature of storage (required for STORAGE industry)
 *               # Other industry fields
 *               otherDescription:
 *                 type: string
 *                 description: Other capacity (required for OTHER industry)
 *               otherCostDetails:
 *                 type: string
 *                 description: Cost of other (required for OTHER industry)
 *     responses:
 *       201:
 *         description: Page created successfully
 *       400:
 *         description: Validation error or bad request
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.post(
    "",
    checkJwt,
    validateRoles([ROLES.USER]),
    handleMultipleFiles([
        { name: FILE_FIELDS.LOGO, maxCount: 1 },
        { name: FILE_FIELDS.COVER, maxCount: 1 },
    ]),
    validate(PageValidation.createPage, "body"),
    (req, res, next) => pageController.createPage(req, req as any, res, next)
);

/**
 * @swagger
 * /page/{id}:
 *   put:
 *     summary: Update an existing page
 *     description: Updates an existing page with the provided details. User must be an admin of the page.
 *     security:
 *       - bearerAuth: []
 *     tags:
 *       - Page
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: ID of the page to update
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               # Same properties as in the POST endpoint, but all optional
 *               name:
 *                 type: string
 *               type:
 *                 type: string
 *                 enum: [COMPANY, EDUCATIONAL_INSTITUTE]
 *               address:
 *                 type: string
 *               locationCountry:
 *                 type: string
 *               branchesCountries:
 *                 type: array
 *                 items:
 *                   type: string
 *               organizationSize:
 *                 type: string
 *                 enum: [ZERO_TO_ONE, TWO_TO_TEN, ELEVEN_TO_FIFTY, FIFTY_ONE_TO_TWO_HUNDRED]
 *               organizationType:
 *                 type: string
 *                 enum: [PUBLICLY_HELD, PRIVATELY_HELD, NON_PROFIT]
 *               industry:
 *                 type: string
 *                 enum: [PRODUCTION, TRANSPORTATION, STORAGE, TECHNOLOGY, FINANCE, EDUCATION, HEALTHCARE, RETAIL, OTHER]
 *               website:
 *                 type: string
 *               tagline:
 *                 type: string
 *               logo:
 *                 type: string
 *                 format: binary
 *               cover:
 *                 type: string
 *                 format: binary
 *               # Industry-specific fields (all optional in update)
 *               productionDescription:
 *                 type: string
 *               energyConsumption:
 *                 type: string
 *               certifications:
 *                 type: string
 *               costDetails:
 *                 type: string
 *               transportationDescription:
 *                 type: string
 *               fleetSize:
 *                 type: integer
 *               operatingRange:
 *                 type: string
 *               transportationCostDetails:
 *                 type: string
 *               storageTemperature:
 *                 type: string
 *               storageCapacity:
 *                 type: string
 *               otherDescription:
 *                 type: string
 *               otherCostDetails:
 *                 type: string
 *     responses:
 *       200:
 *         description: Page updated successfully
 *       400:
 *         description: Validation error or bad request
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - User is not an admin of the page
 *       404:
 *         description: Page not found
 *       500:
 *         description: Server error
 */
router.put(
    "/:id",
    checkJwt,
    validateRoles([ROLES.USER]),
    handleMultipleFiles([
        { name: FILE_FIELDS.LOGO, maxCount: 1 },
        { name: FILE_FIELDS.COVER, maxCount: 1 },
    ]),
    validate(PageValidation.updatePage, "body"),
    (req, res, next) => pageController.updatePage(req, req as any, res, next)
);

/**
 * @swagger
 * /page/{id}:
 *   get:
 *     summary: Get a page by ID
 *     description: Retrieves a page by its ID with details about followers, admins, etc.
 *     security:
 *       - bearerAuth: []
 *     tags:
 *       - Page
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: ID of the page to retrieve
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Page retrieved successfully
 *       404:
 *         description: Page not found
 *       500:
 *         description: Server error
 */
router.get(
    "/:id",
    checkJwt,
    validateRoles([ROLES.USER]),
    (req, res, next) => pageController.getPageById(req, res, next)
);

/**
 * @swagger
 * /page:
 *   get:
 *     summary: Get pages with pagination and filtering
 *     description: Retrieves pages with pagination and optional filtering by type and industry.
 *     security:
 *       - bearerAuth: []
 *     tags:
 *       - Page
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: pageSize
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Number of items per page
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [COMPANY, EDUCATIONAL_INSTITUTE]
 *         description: Filter by page type
 *       - in: query
 *         name: industry
 *         schema:
 *           type: string
 *           enum: [PRODUCTION, TRANSPORTATION, STORAGE, TECHNOLOGY, FINANCE, EDUCATION, HEALTHCARE, RETAIL, OTHER]
 *         description: Filter by industry type
 *     responses:
 *       200:
 *         description: Pages retrieved successfully
 *       500:
 *         description: Server error
 */
router.get(
    "",
    checkJwt,
    validateRoles([ROLES.USER]),
    setPagination,
    (req, res, next) => pageController.getPages(req, res, next)
);

/**
 * @swagger
 * /page/{id}/follow:
 *   post:
 *     summary: Follow or unfollow a page
 *     description: Toggles following status for a page - follows if not following, unfollows if already following.
 *     security:
 *       - bearerAuth: []
 *     tags:
 *       - Page
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: ID of the page to follow/unfollow
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Successfully followed/unfollowed page
 *       404:
 *         description: Page not found
 *       500:
 *         description: Server error
 */
router.post(
    "/:id/follow",
    checkJwt,
    validateRoles([ROLES.USER]),
    (req, res, next) => pageController.followPage(req, res, next)
);

/**
 * @swaggerBeta
 * /page/{id}/admin:
 *   post:
 *     summary: Add a user as admin to a page
 *     description: Adds a user as admin to a page. Current user must be an admin.
 *     security:
 *       - bearerAuth: []
 *     tags:
 *       - Page
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: ID of the page
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *             properties:
 *               userId:
 *                 type: string
 *                 description: ID of the user to add as admin
 *     responses:
 *       200:
 *         description: Admin added successfully
 *       400:
 *         description: Validation error or user already an admin
 *       403:
 *         description: Not authorized to add admins
 *       404:
 *         description: Page or user not found
 *       500:
 *         description: Server error
 */
router.post(
    "/:id/admin",
    checkJwt,
    validateRoles([ROLES.USER]),
    validate(PageValidation.addAdmin, "body"),
    (req, res, next) => pageController.addAdmin(req, res, next)
);

/**
 * @swaggerBeta
 * /page/{id}/admin:
 *   delete:
 *     summary: Remove a user as admin from a page
 *     description: Removes a user as admin from a page. Only the page creator can remove admins.
 *     security:
 *       - bearerAuth: []
 *     tags:
 *       - Page
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: ID of the page
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *             properties:
 *               userId:
 *                 type: string
 *                 description: ID of the user to remove as admin
 *     responses:
 *       200:
 *         description: Admin removed successfully
 *       400:
 *         description: Validation error or user not an admin
 *       403:
 *         description: Not authorized to remove admins
 *       404:
 *         description: Page not found
 *       500:
 *         description: Server error
 */
router.delete(
    "/:id/admin",
    checkJwt,
    validateRoles([ROLES.USER]),
    validate(PageValidation.addAdmin, "body"),
    (req, res, next) => pageController.removeAdmin(req, res, next)
);

/**
 * @swagger
 * /page/{id}:
 *   delete:
 *     summary: Delete a page
 *     description: Deletes a page. Only the page creator can delete a page.
 *     security:
 *       - bearerAuth: []
 *     tags:
 *       - Page
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: ID of the page to delete
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Page deleted successfully
 *       403:
 *         description: Not authorized to delete this page
 *       404:
 *         description: Page not found
 *       500:
 *         description: Server error
 */
router.delete(
    "/:id",
    checkJwt,
    validateRoles([ROLES.USER]),
    (req, res, next) => pageController.deletePage(req, res, next)
);

/**
 * @swagger
 * /page/user/my:
 *   get:
 *     summary: Get pages where the current user is admin or creator
 *     description: Retrieves pages where the current user is either an admin or the creator.
 *     security:
 *       - bearerAuth: []
 *     tags:
 *       - Page
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: pageSize
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Number of items per page
 *       - in: query
 *         name: role
 *         schema:
 *           type: string
 *           enum: [admin, creator]
 *         description: Filter by user's role (admin or creator)
 *     responses:
 *       200:
 *         description: Pages retrieved successfully
 *       500:
 *         description: Server error
 */
router.get(
    "/user/my",
    checkJwt,
    validateRoles([ROLES.USER]),
    setPagination,
    (req, res, next) => pageController.getMyPages(req, res, next)
);

/**
 * @swagger
 * /page/user/followed:
 *   get:
 *     summary: Get pages followed by the current user
 *     description: Retrieves pages that the current user follows.
 *     security:
 *       - bearerAuth: []
 *     tags:
 *       - Page
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: pageSize
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Number of items per page
 *     responses:
 *       200:
 *         description: Followed pages retrieved successfully
 *       500:
 *         description: Server error
 */
router.get(
    "/user/followed",
    checkJwt,
    validateRoles([ROLES.USER]),
    setPagination,
    (req, res, next) => pageController.getFollowedPages(req, res, next)
);

export { router };