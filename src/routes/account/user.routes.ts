import { Router } from "express";
import Joi from "joi";
import { AuthValidation, UserValidation, validate } from "../../validations";
import { UserController } from "../../controllers/account";
import { Bond, PollVote, Post, Saved, User } from "../../entity";
import { getRepository } from "typeorm";
import { AppDataSource } from "../../typeorm.config";
import {
  checkJwt,
  handleMultipleFiles,
  optionalCheckJwt,
  QrCheckJwt,
  setPagination,
  validateRoles,
} from "../../middleware";
import { Notification } from "../../models";
import { FILE_FIELDS, ROLES } from "../../constants";
import { parseJsonFields } from "../../utils";

const router = Router();
const userRepository = AppDataSource.getRepository(User);
const postRepository = AppDataSource.getRepository(Post); // Assuming User is the correct entity for notifications
const bondRepository = AppDataSource.getRepository(Bond);
const savedRepository = AppDataSource.getRepository(Saved); // Assuming User is the correct entity for notifications
const pollVoteRepository = AppDataSource.getRepository(PollVote); // Assuming User is the correct entity for notifications

const userController = new UserController(
  userRepository,
  Notification,
  postRepository,
  bondRepository,
  savedRepository,
  pollVoteRepository

);

/**
 * @swagger
 * /user/verify-qr:
 *   post:
 *     security:
 *       - bearerAuth: []
 *     tags:
 *     - User
 *     summary: Verify token for 2FA
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - token
 *             properties:
 *               token:
 *                 type: string
 *                 example: "123456"
 *     responses:
 *       200:
 *         description: Token verified successfully
 *       401:
 *         description: Invalid token
 *       500:
 *         description: Error verifying token
 */
router.post(
  "/verify-qr",
  QrCheckJwt,
  validateRoles([ROLES.USER]),
  validate(UserValidation.verifyQr, "body"),
  (req, res, next) => userController.verifyQr(req, res, next)
);

/**
 * @swagger
 * /user/profile:
 *   get:
 *     summary: Get authenticated user's profile
 *     description: This endpoint retrieves the profile details of the authenticated user.
 *     security:
 *       - bearerAuth: []
 *     tags:
 *       - User
 *     responses:
 *       200:
 *         description: User profile retrieved successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                   description: User ID.
 *                 username:
 *                   type: string
 *                   description: Username of the user.
 *                 email:
 *                   type: string
 *                   description: Email of the user.
 *                 fullName:
 *                   type: string
 *                   description: Full name of the user.
 *                 createdAt:
 *                   type: string
 *                   format: date-time
 *                   description: User account creation date.
 *       404:
 *         description: User profile not found.
 *       500:
 *         description: Server error.
 */
router.get("/profile", checkJwt, (req, res, next) =>
  userController.getUserProfile(req, res, next)
);

/**
 * @swagger
 * /user/notifications:
 *   get:
 *     summary: Get all notifications for the authenticated user
 *     description: This endpoint retrieves all notifications associated with the authenticated user. Pagination is supported for retrieving multiple notifications.
 *     security:
 *       - bearerAuth: []
 *     tags:
 *       - User
 *     parameters:
 *       - in: query
 *         name: pageSize
 *         required: false
 *         description: Number of items per page (for paginated results).
 *         schema:
 *           type: integer
 *           example: 10
 *       - in: query
 *         name: page
 *         required: false
 *         description: Page number to retrieve (for paginated results).
 *         schema:
 *           type: integer
 *           example: 1
 *     responses:
 *       200:
 *         description: Notifications retrieved successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 notifications:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                         description: ID of the notification.
 *                       title:
 *                         type: string
 *                         description: Title of the notification.
 *                       message:
 *                         type: string
 *                         description: Content of the notification.
 *                       type:
 *                         type: string
 *                         description: Type of the notification (e.g., alert, info, reminder).
 *                       isRead:
 *                         type: boolean
 *                         description: Whether the notification has been read.
 *                       createdAt:
 *                         type: string
 *                         format: date-time
 *                         description: Date and time the notification was created.
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     totalItems:
 *                       type: integer
 *                       description: Total number of items.
 *                     currentPage:
 *                       type: integer
 *                       description: Current page number.
 *                     pageSize:
 *                       type: integer
 *                       description: Number of items per page.
 *                     totalPages:
 *                       type: integer
 *                       description: Total number of pages.
 *       404:
 *         description: No notifications found for the user.
 *       500:
 *         description: Server error.
 */
router.get("/notifications", checkJwt, setPagination, (req, res, next) =>
  userController.fetchNotifications(req, res, next)
);

/**
 * @swagger
 * /user/add-profile:
 *   put:
 *     summary: Update User Profile Details
 *     description: This endpoint allows users with the USER role to Update User Profile Image.
 *     security:
 *       - bearerAuth: []
 *     tags:
 *       - User
 *     requestBody:
 *       required: false
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               country:
 *                 type: string
 *                 description: Details about the User.
 *               city:
 *                 type: string
 *                 description: Details about the User.
 *               about:
 *                  type: object
 *                  properties:
 *                    dob:
 *                       type: string
 *                       description: Date of Birth of User
 *               designation:
 *                 type: string
 *                 description: Details about the User.
 *               industry:
 *                 type: string
 *                 description: Details about the User.
 *               company:
 *                 type: string
 *                 description: Details about the User.
 *               image:
 *                 type: string
 *                 format: binary
 *                 description: Profile image of the User.
 *
 *     responses:
 *       201:
 *         description: user profile updated successfully.
 *       400:
 *         description: Validation error.
 *       403:
 *         description: Forbidden.
 *       500:
 *         description: Server error.
 */
router.put(
  "/add-profile",
  checkJwt,
  validateRoles([ROLES.USER]),
  parseJsonFields(["about"]),
  handleMultipleFiles([{ name: FILE_FIELDS.SINGLE_IMAGE, maxCount: 1 }]),
  (req, res, next) => userController.updateProfileImage(req, res, next)
);

/**
 * @swagger
 * /user/profile:
 *   put:
 *     summary: Update User Profile Details
 *     description: This endpoint allows users with the USER role to Update User Profile Image.
 *     security:
 *       - bearerAuth: []
 *     tags:
 *       - User
 *     requestBody:
 *       required: false
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               country:
 *                 type: string
 *                 description: Details about the User.
 *               city:
 *                 type: string
 *                 description: Details about the User.
 *               designation:
 *                 type: string
 *                 description: Details about the User.
 *               industry:
 *                 type: string
 *                 description: Details about the User.
 *               company:
 *                 type: string
 *                 description: Details about the User.
 *               about:
 *                  type: object
 *                  required: false
 *                  properties:
 *                    description:
 *                       type: string
 *                       description: A brief description of the post
 *                    htmlContent:
 *                       type: string
 *                       description: HTML content related to the post (e.g., description with HTML tags)
 *               image:
 *                 type: string
 *                 format: binary
 *                 description: Profile image of the User.
 *               cover:
 *                 type: string
 *                 format: binary
 *                 description: Cover image of the User.
 *
 *     responses:
 *       201:
 *         description: user profile updated successfully.
 *       400:
 *         description: Validation error.
 *       403:
 *         description: Forbidden.
 *       500:
 *         description: Server error.
 */
router.put(
  "/profile",
  checkJwt,
  validateRoles([ROLES.USER]),
  parseJsonFields(["about"]),
  handleMultipleFiles([
    { name: FILE_FIELDS.SINGLE_IMAGE, maxCount: 1 },
    { name: FILE_FIELDS.COVER, maxCount: 1 },
  ]),
  (req, res, next) => userController.updateUser(req, res, next)
);

/**
 * @swagger
 * /user/change-password:
 *   post:
 *     summary: Change user password
 *     description: Allows users to change their password by providing the old password and a new password.
 *     security:
 *       - bearerAuth: []
 *     tags:
 *       - User
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               oldPassword:
 *                 type: string
 *                 description: The current password of the user.
 *                 example: oldPassword123
 *               newPassword:
 *                 type: string
 *                 description: The new password to set.
 *                 example: newPassword456
 *             required:
 *               - oldPassword
 *               - newPassword
 *     responses:
 *       200:
 *         description: Password changed successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Password changed successfully.
 *       400:
 *         description: Validation error.
 *       401:
 *         description: Unauthorized - Incorrect old password.
 *       500:
 *         description: Internal server error.
 */
router.post(
  "/change-password",
  checkJwt,
  validateRoles([ROLES.USER]),
  validate(UserValidation.changePasswordValidation, "body"),
  (req, res, next) => userController.changePassword(req, res, next)
);

/**
 * @swagger
 * /user/email:
 *   put:
 *     summary: Update user email address
 *     description: This endpoint allows users to update their email address.
 *     security:
 *       - bearerAuth: []
 *     tags:
 *       - User
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               newEmail:
 *                 type: string
 *                 description: The new email address.
 *               oldEmail:
 *                 type: string
 *                 description: The current email address.
 *     responses:
 *       200:
 *         description: Email updated successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Email updated successfully.
 *       400:
 *         description: Validation error.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Validation error.
 *       404:
 *         description: User not found.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: User not found.
 *       500:
 *         description: Internal server error.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: An unexpected error occurred.
 */
router.put(
  "/email",
  checkJwt,
  validateRoles([ROLES.USER]),
  validate(UserValidation.updateEmail, "body"),
  (req, res, next) => userController.updateEmail(req, res, next)
);

/**
 * @swagger
 * /user/confirm-email:
 *   get:
 *     summary: Verify the email confirmation token
 *     description: This endpoint verifies the email confirmation token to update the user’s email address.
 *     security:
 *       - bearerAuth: []
 *     tags:
 *       - User
 *     parameters:
 *       - in: query
 *         name: token
 *         required: true
 *         schema:
 *           type: string
 *         description: The confirmation token sent to the user.
 *       - in: query
 *         name: expiresAt
 *         required: true
 *         schema:
 *           type: string
 *           format: date-time
 *         description: The expiration time of the token.
 *     responses:
 *       200:
 *         description: Token is valid and email has been successfully updated.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Email has been successfully updated and verified."
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       example: "12345"
 *                     email:
 *                       type: string
 *                       example: "newemail@example.com"
 *       400:
 *         description: Bad request due to invalid or missing token.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Invalid or missing token."
 *       403:
 *         description: The token has expired.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Token has expired."
 *       404:
 *         description: User not found for the given token.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "User not found."
 *       500:
 *         description: Internal server error.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "An unexpected error occurred."
 */
router.get("/confirm-email", checkJwt, (req, res, next) =>
  userController.verifyTokenAPI(req, res, next)
);

/**
 * @swagger
 * /user/generate-qr:
 *   get:
 *     summary: Generate QR code for 2FA
 *     description: This endpoint generates a QR code for 2FA using the user's email address.
 *     security:
 *       - bearerAuth: []
 *     tags:
 *     - User
 *     responses:
 *       200:
 *         description: QR code generated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 secret:
 *                   type: string
 *                 qrCode:
 *                   type: string
 *       500:
 *         description: Error generating QR code
 */
router.get(
  "/generate-qr",
  checkJwt,
  validateRoles([ROLES.USER]),
  (req, res, next) => userController.generateQr(req, res, next)
);

/**
 * @swagger
 * /user/resync-qr:
 *   post:
 *     security:
 *       - bearerAuth: []
 *     tags:
 *     - User
 *     summary: Verify token for 2FA
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - token
 *             properties:
 *               firstToken:
 *                 type: string
 *                 example: "123456"
 *               secondToken:
 *                 type: string
 *                 example: "123456"
 *     responses:
 *       200:
 *         description: QR resync successfully
 *       401:
 *         description: Invalid token
 *       500:
 *         description: Error verifying token
 */
router.post(
  "/resync-qr",
  QrCheckJwt,
  validateRoles([ROLES.USER]),
  validate(UserValidation.verifyResyncQr, "body"),
  (req, res, next) => userController.verifyResync(req, res, next)
);

/**
 * @swagger
 * /user/verify-new-device:
 *   get:
 *     security:
 *       - bearerAuth: []
 *     summary: Verify Device for Authentication
 *     description: Send a verification email to the user's email address to verify the device for authentication.
 *     tags:
 *      - User
 *     responses:
 *       200:
 *         description: Password reset email sent successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Email Sent successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                       example: 1
 *                     email:
 *                       type: string
 *                       format: email
 *                       example: user@example.com
 *       404:
 *         description: User not found
 *       400:
 *         description: Validation error or social login email
 *       500:
 *         description: Server error
 */
router.get("/verify-new-device", QrCheckJwt, (req, res, next) =>
  userController.verifyNewDevice(req, res, next)
);

/**
 * @swagger
 * /user/timeline:
 *   get:
 *     summary: Get user's timeline
 *     description: Fetch posts from user and their accepted bonds.
 *     security:
 *       - bearerAuth: []
 *     tags:
 *       - Timeline
 *     parameters:
 *       - in: query
 *         name: pageSize
 *         required: false
 *         schema:
 *           type: integer
 *           example: 10
 *       - in: query
 *         name: page
 *         required: false
 *         description: Page number to retrieve (for paginated results).
 *         schema:
 *           type: integer
 *           example: 1
 *     responses:
 *       200:
 *         description: Timeline fetched successfully
 *       400:
 *         description: Validation error
 *       403:
 *         description: Forbidden
 *       500:
 *         description: Server error
 */
router.get(
  "/timeline",
  checkJwt,
  validateRoles([ROLES.USER]),
  setPagination,
  (req, res, next) => userController.getTimeline(req, res, next)
);

/**
 * @swagger
 * /user/share/{data}:
 *   get:
 *     summary: Get a specific post by ID or all spaces for the authenticated user
 *     description: This endpoint retrieves a specific space by its ID (if provided) or all spaces associated with the authenticated user. Pagination is supported for retrieving multiple spaces.
 *     security:
 *       - bearerAuth: []
 *     tags:
 *       - General
 *     parameters:
 *       - in: path
 *         name: data
 *         required: true
 *         description: Data of Entity.
 *     responses:
 *       200:
 *         description: space found by ID or all spaces for the authenticated user.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 spaces:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       spaceName:
 *                         type: string
 *                         description: Name of the space.
 *                       spaceCategory:
 *                         type: array
 *                         items:
 *                           type: object
 *                           properties:
 *                             name:
 *                               type: string
 *                               description: Name of the category.
 *                             description:
 *                               type: string
 *                               description: Description of the category.
 *                         description: Categories of the space.
 *                       details:
 *                         type: object
 *                         description: Details about the space.
 *                       location:
 *                         type: object
 *                         properties:
 *                           long:
 *                             type: number
 *                             description: Longitude of the space's location.
 *                           lat:
 *                             type: number
 *                             description: Latitude of the space's location.
 *                           additional:
 *                             type: string
 *                             description: Additional information about the location.
 *                       status:
 *                         type: string
 *                         enum:
 *                           - PUBLISH
 *                           - DRAFT
 *                           - ARCHIVE
 *                       coverImages:
 *                         type: array
 *                         items:
 *                           type: object
 *                           properties:
 *                             url:
 *                               type: string
 *                               description: URL of the cover image.
 *                             public_id:
 *                               type: string
 *                               description: Public ID of the cover image.
 *       404:
 *         description: space not found (if ID is provided) or no spaces found for the user.
 *       500:
 *         description: Server error.
 */
router.get("/share/:data", optionalCheckJwt, (req, res, next) =>
  userController.getSharedEntity(req, res, next)
);

/**
 * @swagger
 * /user/profile/settings:
 *   put:
 *     summary: Update User Profile Settings
 *     description: Update your visibility and privacy preferences for different profile sections.
 *     security:
 *       - bearerAuth: []
 *     tags:
 *       - User
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               profileViewingOption:
 *                 type: string
 *                 enum: [Your name and headline, Private profile characteristics, Private mode]
 *                 description: Who can see your name and headline when viewing profiles.
 *               showProfilePhoto:
 *                 type: boolean
 *               pageVisitVisibility:
 *                 type: boolean
 *               allowPublicProfileEdit:
 *                 type: boolean
 *               showEmail:
 *                 type: boolean
 *               showConnections:
 *                 type: boolean
 *               showFollowedMembers:
 *                 type: boolean
 *               showLastName:
 *                 type: boolean
 *               showOrganizationsAndInterests:
 *                 type: boolean
 *               allowPageOwnersToExportData:
 *                 type: boolean
 *               discoverableOutsideLinkedIn:
 *                 type: boolean
 *               discoverableByEmail:
 *                 type: boolean
 *               discoverableByPhone:
 *                 type: boolean
 *               showHeadline:
 *                 type: boolean
 *               showSummary:
 *                 type: boolean
 *               showArticlesAndActivity:
 *                 type: boolean
 *               showCurrentExperience:
 *                 type: boolean
 *               showCurrentExperienceDetails:
 *                 type: boolean
 *               showPastExperience:
 *                 type: boolean
 *               showPastExperienceDetails:
 *                 type: boolean
 *               showEducation:
 *                 type: boolean
 *               showEducationDetails:
 *                 type: boolean
 *               showCertifications:
 *                 type: boolean
 *               showProjects:
 *                 type: boolean
 *               showLanguages:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: User profile settings updated successfully
 *       400:
 *         description: Validation error
 *       403:
 *         description: Forbidden
 *       500:
 *         description: Internal Server Error
 */
router.put(
  "/profile/settings",
  checkJwt,
  validateRoles([ROLES.USER]),
  (req, res, next) => userController.updateProfileSettings(req, res, next)
);

/**
 * @swagger
 * /user/public-profile:
 *   get:
 *     summary: Get Public User Profile
 *     description: This endpoint retrieves a user's public profile based on their privacy settings.
 *     security:
 *       - bearerAuth: []
 *     tags:
 *       - User
 *     parameters:
 *       - in: query
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the user whose public profile is being requested.
 *       - in: query
 *         name: bond
 *         required: false
 *         schema:
 *           type: boolean
 *     responses:
 *       200:
 *         description: User profile retrieved successfully.
 *       404:
 *         description: User profile not found.
 *       500:
 *         description: Server error.
 */
router.get(
  "/public-profile",
  checkJwt,
  (req, res, next) => userController.getPublicUserProfile(req, res, next)
);

/**
 * @swagger
 * /user/public-profile/post/{id}:
 *   get:
 *     summary: Get a specific post by ID or all posts for the given user
 *     description: This endpoint retrieves a specific post by its ID (if provided) or all posts associated with the authenticated user. Pagination is supported for retrieving multiple posts.
 *     security:
 *       - bearerAuth: []
 *     tags:
 *       - User
 *     parameters:
 *       - in: path
 *         name: id
 *         required: false
 *         description: ID of the post to retrieve (optional).
 *         schema:
 *           type: string
 *       - in: query
 *         name: pageSize
 *         required: false
 *         schema:
 *           type: integer
 *           example: 10
 *       - in: query
 *         name: profileId
 *         required: true
 *         schema:
 *           type: string
 *           example: 123
 *       - in: query
 *         name: page
 *         required: false
 *         description: Page number to retrieve (for paginated results).
 *         schema:
 *           type: integer
 *           example: 1
 *       - in: query
 *         name: status
 *         required: false
 *         description: Status should be PUBLISH.
 *         schema:
 *           type: string
 *           example: PUBLISH
 *     responses:
 *       200:
 *         description: Post found by ID or all posts for the authenticated user.
 *       404:
 *         description: Post not found (if ID is provided) or no posts found for the user.
 *       500:
 *         description: Server error.
 */
router.get(
  "/public-profile/post/:id?",
  checkJwt,
  validateRoles([ROLES.USER]),
  setPagination,
  (req, res, next) => userController.getAllPostOfUser(req, res, next)
);

export { router };
