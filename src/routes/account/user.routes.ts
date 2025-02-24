import { Router } from "express";
import Joi from "joi";
import { AuthValidation, UserValidation, validate } from "../../validations";
import { UserController } from "../../controllers/account";
import { User } from "../../entity";
import { getRepository } from "typeorm";
import { AppDataSource } from "../../typeorm.config";
import {
  checkJwt,
  handleMultipleFiles,
  QrCheckJwt,
  setPagination,
  validateRoles,
} from "../../middleware";
import { Notification } from "../../models";
import { FILE_FIELDS, ROLES } from "../../constants";
import { parseJsonFields } from "../../utils";

const router = Router();
const userRepository = AppDataSource.getRepository(User);


const userController = new UserController(
  userRepository,
  Notification,
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
router.get("/profile",checkJwt, (req, res, next) =>
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
router.get("/notifications",checkJwt, setPagination, (req, res, next) =>
  userController.fetchNotifications(req, res, next)
);

/**
 * @swagger
 * /user/profile:
 *   put:
 *     summary: Update user profile
 *     description: This endpoint allows users to update their profile details.
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
 *               firstName:
 *                 type: string
 *                 description: The user's first name.
 *               lastName:
 *                 type: string
 *                 description: The user's last name.
 *               profileImage:
 *                 type: string
 *                 description: The URL of the user's profile image.
 *               loginType:
 *                 type: string
 *                 enum: [email, google, facebook]
 *                 description: The type of login used.
 *               isSocialLogin:
 *                 type: boolean
 *                 description: Indicates if the user logged in via social login.
 *               profile:
 *                 type: boolean
 *                 description: Indicates if the profile is active.
 *               sendEmails:
 *                 type: boolean
 *                 description: Whether the user opts to receive emails.
 *               socialId:
 *                 type: string
 *                 description: The social login ID.
 *     responses:
 *       200:
 *         description: User profile updated successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: User profile updated successfully.
 *                 data:
 *                   type: object
 *                   properties:
 *                     firstName:
 *                       type: string
 *                     lastName:
 *                       type: string
 *                     profileImage:
 *                       type: string
 *                     loginType:
 *                       type: string
 *                     isSocialLogin:
 *                       type: boolean
 *                     profile:
 *                       type: boolean
 *                     sendEmails:
 *                       type: boolean
 *                     socialId:
 *                       type: string
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
  "/profile",
  checkJwt,
  validateRoles([ROLES.USER]),
  validate(UserValidation.updateUser, "body"),
  (req, res, next) => userController.updateUser(req, res, next)
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
  handleMultipleFiles([
    { name: FILE_FIELDS.IMAGE, maxCount: 1 },
  ]),
  (req, res, next) => userController.updateProfileImage(req, res, next)
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
router.get(
  "/verify-new-device", 
  QrCheckJwt,
  (req, res, next) =>
    userController.verifyNewDevice(req, res, next)
);





export { router };
