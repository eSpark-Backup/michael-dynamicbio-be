import { Router } from "express";
import Joi from "joi";
import { AuthValidation, validate } from "../../validations";
import { AuthController } from "../../controllers/account";
import { User } from "../../entity";
import { getRepository } from "typeorm";
import { AppDataSource } from "../../typeorm.config";

const router = Router();
const userRepository = AppDataSource.getRepository(User);
const authController = new AuthController(userRepository);

/**
 * @swagger
 * /auth/register:
 *   post:
 *     summary: Register a new user
 *     description: This endpoint registers a new user.
 *     tags:
 *      - Auth
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               firstName:
 *                 type: string
 *               lastName:
 *                 type: string
 *               email:
 *                 type: string
 *                 format: email
 *               countryCode:
 *                 type: string
 *               profileImage:
 *                 type: string
 *                 required: false
 *               loginType:
 *                 type: string
 *                 enum: [local, facebook, google, linkedin]
 *               isSocialLogin:
 *                 type: boolean
 *               phoneNumber:
 *                 type: string
 *               password:
 *                 type: string
 *               socialId:
 *                 type: string
 *               role:
 *                 type: string
 *               about:
 *                  type: object
 *                  properties:
 *                    dob:
 *                       type: string
 *                       description: Date of Birth of User
 *     responses:
 *       201:
 *         description: User registered successfully
 *       400:
 *         description: Validation error
 *       500:
 *         description: Server error
 */
router.post(
  "/register",
  validate(AuthValidation.signupUser, "body"),
  (req, res, next) => authController.registerUser(req, res, next)
);

/**
 * @swagger
 * /auth/login:
 *   post:
 *     summary: Login user
 *     description: This endpoint logs in a user.
 *     tags:
 *      - Auth
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *                 minLength: 8
 *     responses:
 *       200:
 *         description: Login successful
 *       401:
 *         description: Invalid credentials
 *       400:
 *         description: Validation error
 *       500:
 *         description: Server error
 */
router.post(
  "/login",
  validate(AuthValidation.loginUser, "body"), // Add a validation schema for login
  (req, res, next) => authController.loginUser(req, res, next)
);

/**
 * @swagger
 * /auth/delete:
 *   delete:
 *     summary: Delete user account
 *     description: Deletes a user account using their email address.
 *     tags:
 *      - Auth
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *     responses:
 *       200:
 *         description: Account deleted successfully
 *       404:
 *         description: User not found
 *       400:
 *         description: Validation error
 *       500:
 *         description: Server error
 */
router.delete(
  "/delete",
  validate(AuthValidation.deleteAccountValidation, "body"),
  (req, res, next) => authController.deleteAccount(req, res, next)
);

/**
 * @swagger
 * /auth/forgot-password:
 *   post:
 *     summary: Forgot Password
 *     description: Sends a password reset email to the user if the email exists and is not a social login.
 *     tags:
 *      - Auth
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *             required:
 *               - email
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
router.post(
  "/forgot-password",
  validate(AuthValidation.forgotPassword, "body"),
  (req, res, next) => authController.forgotPassword(req, res, next)
);

/**
 * @swagger
 * /auth/find-email:
 *   post:
 *     summary: Find Account Email
 *     description: Sends a password reset email to the user if the email exists and is not a social login.
 *     tags:
 *      - Auth
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *             required:
 *               - email
 *     responses:
 *       200:
 *         description: Account Email Found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Account fetched successfully
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
router.post(
  "/find-email",
  validate(AuthValidation.findEmail, "body"),
  (req, res, next) => authController.findEmail(req, res, next)
);

/**
 * @swagger
 * /auth/set-password/{token}/{expiresAt}:
 *   post:
 *     summary: Set Password
 *     description: Sets a user's password using a token and expiration time.
 *     tags:
 *      - Auth
 *     parameters:
 *       - in: path
 *         name: token
 *         required: true
 *         schema:
 *           type: string
 *         description: The token for setting the password.
 *       - in: path
 *         name: expiresAt
 *         required: true
 *         schema:
 *           type: string
 *           format: date-time
 *         description: The expiration time of the token.
 *     responses:
 *       200:
 *         description: Password Set successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Password Set successfully
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
 *       400:
 *         description: Validation error or invalid/expired token
 *       404:
 *         description: User not found
 *       500:
 *         description: Server error
 */
router.post(
  "/set-password/:token/:expiresAt",
  validate(AuthValidation.passwordReset, "body"),
  (req, res, next) => authController.setPassword(req, res, next)
);

/**
 * @swagger
 * /auth/forgot-password:
 *   post:
 *     summary: Forgot Password
 *     description: Sends a password reset email to the user if the email exists and is not a social login.
 *     tags:
 *      - Auth
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *             required:
 *               - email
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
router.post(
  "/forgot-password",
  validate(AuthValidation.forgotPassword, "body"),
  (req, res, next) => authController.forgotPassword(req, res, next)
);

/**
 * @swagger
 * /auth/reset-password/{token}/{expiresAt}:
 *   post:
 *     summary: Reset Password
 *     description: Resets a user's password using a token and expiration time.
 *     tags:
 *      - Auth
 *     parameters:
 *       - in: path
 *         name: token
 *         required: true
 *         schema:
 *           type: string
 *         description: The token for resetting the password.
 *       - in: path
 *         name: expiresAt
 *         required: true
 *         schema:
 *           type: string
 *           format: date-time
 *         description: The expiration time of the token.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               newPassword:
 *                 type: string
 *                 minLength: 8
 *                 description: The new password to be set.
 *             required:
 *               - newPassword
 *     responses:
 *       200:
 *         description: Password reset successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Password reset successfully
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
 *       400:
 *         description: Validation error or invalid/expired token
 *       404:
 *         description: User not found
 *       500:
 *         description: Server error
 */
router.post(
  "/reset-password/:token/:expiresAt",
  validate(AuthValidation.passwordReset, "body"),
  (req, res, next) => authController.resetPassword(req, res, next)
);

/**
 * @swagger
 * /auth/register-device/{token}/{expiresAt}:
 *   post:
 *     summary: GET QR CODE
 *     description: Sets a user's password using a token and expiration time.
 *     tags:
 *      - Auth
 *     parameters:
 *       - in: path
 *         name: token
 *         required: true
 *         schema:
 *           type: string
 *         description: The token for setting the New Device For 2FA.
 *       - in: path
 *         name: expiresAt
 *         required: true
 *         schema:
 *           type: string
 *           format: date-time
 *         description: The expiration time of the token.
 *     responses:
 *       200:
 *         description: Password Set successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Password Set successfully
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
 *       400:
 *         description: Validation error or invalid/expired token
 *       404:
 *         description: User not found
 *       500:
 *         description: Server error
 */
router.post("/register-device/:token/:expiresAt", (req, res, next) =>
  authController.verifyRegisteredDevice(req, res, next)
);

/**
 * @swagger
 * /auth/resend-email:
 *   post:
 *     summary: Resend verification email
 *     description: Resends a verification email to the user if their account is not yet verified.
 *     tags:
 *      - Auth
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *             required:
 *               - email
 *     responses:
 *       200:
 *         description: Verification email resent successfully
 *       404:
 *         description: User not found or already verified
 *       500:
 *         description: Server error
 */
router.post(
  "/resend-email",
  validate(AuthValidation.findEmail, "body"),
  (req, res, next) => authController.resendEmail(req, res, next)
);

/**
 * @swagger
 * /auth/verify-email:
 *   get:
 *     summary: Verify user email
 *     description: Verifies a user's email using a token from the email link.
 *     tags:
 *      - Auth
 *     parameters:
 *       - in: query
 *         name: token
 *         required: true
 *         schema:
 *           type: string
 *         description: The verification token.
 *     responses:
 *       200:
 *         description: Email verified successfully
 *       400:
 *         description: Invalid or expired token
 *       404:
 *         description: User not found
 */
router.get("/verify-email", (req, res, next) =>
  authController.verifyEmail(req, res, next)
);

export { router };
