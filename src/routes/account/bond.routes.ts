import { Router } from "express";
import Joi from "joi";
import {
  AuthValidation,
  BondValidation,
  PostValidation,
  UserValidation,
  validate,
} from "../../validations";
import { BondController } from "../../controllers/account";
import { Bond, User } from "../../entity";
import { AppDataSource } from "../../typeorm.config";
import {
  checkJwt,
  handleMultipleFiles,
  QrCheckJwt,
  setPagination,
  validateRoles,
} from "../../middleware";
import { ROLES } from "../../constants";

const router = Router();
const userRepository = AppDataSource.getRepository(User);

const bondRepository = AppDataSource.getRepository(Bond);

const bondController = new BondController(userRepository, bondRepository);

/**
 * @swagger
 * /bond:
 *   get:
 *     summary: Get all Bonds (Users)
 *     description: Retrieve a list of all Bonds (users) with optional pagination and filters by name, email, or ID.
 *     security:
 *       - bearerAuth: []
 *     tags:
 *       - Bond
 *     parameters:
 *       - in: query
 *         name: pageSize
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Number of records to fetch per page.
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 0
 *         description: Number of records to skip.
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search users by first name, last name, or email.
 *       - in: query
 *         name: id
 *         schema:
 *           type: string
 *         description: Filter by specific user ID.
 *     responses:
 *       200:
 *         description: Bonds fetched successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Bonds fetched successfully.
 *                 data:
 *                   type: object
 *                   properties:
 *                     users:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                             example: user-id-123
 *                           firstName:
 *                             type: string
 *                             example: John
 *                           lastName:
 *                             type: string
 *                             example: Doe
 *                           email:
 *                             type: string
 *                             example: john.doe@example.com
 *                           profileImage:
 *                             type: string
 *                             example: https://example.com/profile.jpg
 *       400:
 *         description: Validation error.
 *       403:
 *         description: Forbidden.
 *       500:
 *         description: Server error.
 */

router.get("/", checkJwt, validateRoles([ROLES.USER]),
setPagination,

 (req, res, next) =>
  bondController.getAllUsers(req, res, next)
);

/**
 * @swagger
 * /bond:
 *   post:
 *     summary: Send a bond request
 *     description: Authenticated users can send bond requests to connect with others.
 *     security:
 *       - bearerAuth: []
 *     tags:
 *       - Bond
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - recipientId
 *             properties:
 *               recipientId:
 *                 type: string
 *                 description: The ID of the user to send a bond request to.
 *     responses:
 *       201:
 *         description: Bond created successfully.
 *       400:
 *         description: Validation or duplicate bond error.
 *       403:
 *         description: Forbidden.
 *       500:
 *         description: Server error.
 */
router.post(
  "/",
  checkJwt,
  validateRoles([ROLES.USER]),
  validate(BondValidation.CreateBondValidation, "body"),
  (req, res, next) => bondController.createBond(req, res, next)
);



/**
 * @swagger
 * /bond/user-bonds:
 *   get:
 *     summary: Get all Bonds (User Friends)
 *     description: Retrieve a list of all Bonds (user Friends) with optional pagination and filters by name, email, or ID.
 *     security:
 *       - bearerAuth: []
 *     tags:
 *       - Bond
 *     parameters:
 *       - in: query
 *         name: pageSize
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Number of records to fetch per page.
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 0
 *         description: Number of records to skip.
 *       - in: query
 *         name: id
 *         schema:
 *           type: string
 *         description: Filter by specific user ID.
 *     responses:
 *       200:
 *         description: Bonds fetched successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Bonds fetched successfully.
 *                 data:
 *                   type: object
 *                   properties:
 *                     users:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                             example: user-id-123
 *                           firstName:
 *                             type: string
 *                             example: John
 *                           lastName:
 *                             type: string
 *                             example: Doe
 *                           email:
 *                             type: string
 *                             example: john.doe@example.com
 *                           profileImage:
 *                             type: string
 *                             example: https://example.com/profile.jpg
 *       400:
 *         description: Validation error.
 *       403:
 *         description: Forbidden.
 *       500:
 *         description: Server error.
 */

router.get("/user-bonds", checkJwt, validateRoles([ROLES.USER]),
setPagination,

 (req, res, next) =>
  bondController.getAllUserFriends(req, res, next)
);



/**
 * @swagger
 * /bond/requests:
 *   get:
 *     summary: Get bond requests
 *     description: Retrieve all bond requests sent or received by the user. You can filter by sent, received, or get all.
 *     security:
 *       - bearerAuth: []
 *     tags:
 *       - Bond
 *     parameters:
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [sent, received, all]
 *         description: Filter bond requests by type. (sent = bonds you sent, received = bonds you received, all = both)
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number for pagination.
 *       - in: query
 *         name: pageSize
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Number of items per page.
 *     responses:
 *       200:
 *         description: Bond requests fetched successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Bond requests fetched successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     bonds:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                             example: "bond-id-123"
 *                           requester:
 *                             type: object
 *                             properties:
 *                               id:
 *                                 type: string
 *                                 example: "user-id-1"
 *                               firstName:
 *                                 type: string
 *                                 example: "Michael"
 *                               lastName:
 *                                 type: string
 *                                 example: "Scott"
 *                           recipient:
 *                             type: object
 *                             properties:
 *                               id:
 *                                 type: string
 *                                 example: "user-id-2"
 *                               firstName:
 *                                 type: string
 *                                 example: "Pam"
 *                               lastName:
 *                                 type: string
 *                                 example: "Beesly"
 *                           status:
 *                             type: string
 *                             example: "PENDING"
 *                           createdAt:
 *                             type: string
 *                             format: date-time
 *                             example: "2025-04-04T12:34:56.789Z"
 *                     pagination:
 *                       type: object
 *                       properties:
 *                         totalItems:
 *                           type: integer
 *                           example: 100
 *                         currentPage:
 *                           type: integer
 *                           example: 1
 *                         pageSize:
 *                           type: integer
 *                           example: 10
 *                         totalPages:
 *                           type: integer
 *                           example: 10
 */

router.get(
  "/requests",
  checkJwt,
  validateRoles([ROLES.USER]),
  setPagination,
  (req, res, next) => bondController.getAllBondRequests(req, res, next)
);



/**
 * @swagger
 * /bond/update-status:
 *   post:
 *     summary: Update bond request status
 *     description: Update the status of a bond request. You can accept, reject, block, or cancel a bond based on your action.
 *     security:
 *       - bearerAuth: []
 *     tags:
 *       - Bond
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - bondId
 *               - action
 *             properties:
 *               bondId:
 *                 type: string
 *                 example: "bond-id-123"
 *               action:
 *                 type: string
 *                 enum: [accepted, rejected, blocked, canceled]
 *                 description: Action to perform on the bond request.
 *     responses:
 *       200:
 *         description: Bond request updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Bond request updated successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       example: bond-id-123
 *                     status:
 *                       type: string
 *                       enum: [pending, accepted, rejected, blocked, canceled]
 *                       example: accepted
 *       400:
 *         description: Invalid action or bond status
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Bond not found
 */

router.post(
  "/update-status",
  checkJwt,
  validateRoles([ROLES.USER]),
  (req, res, next) => bondController.updateBondStatus(req, res, next)
);
export { router };
