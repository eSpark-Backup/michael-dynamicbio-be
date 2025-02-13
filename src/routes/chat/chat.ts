import express, { Router } from "express";
import {
  deleteChat,
  getChatDetails,
  getMessages,
  getMyChats,
  sendAttachments,
} from "../../controllers";
import { atachmentsMulter, isAuthenticated } from "../../middleware";
import {
  chatIdValidator,
  sendAttachmentsValidator,
  validateHandler,
} from "../../lib";

const router = Router();

router.use(isAuthenticated);

/**
 * @swagger
 * /chat/my:
 *   get:
 *     summary: Get authenticated user's Chats
 *     description: This endpoint retrieves the profile details of the authenticated user.
 *     security:
 *       - bearerAuth: []
 *     tags:
 *       - Chat
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
 *       404:
 *         description: User Chat not found.
 *       500:
 *         description: Server error.
 */
router.get("/my", getMyChats);

// Send Attachments
router.post(
  "/message",
  atachmentsMulter,
  sendAttachmentsValidator(),
  validateHandler,
  sendAttachments
);

/**
 * @swagger
 * /chat/message/{id}:
 *   get:
 *     summary: Get all notifications for the authenticated user
 *     description: This endpoint retrieves all notifications associated with the authenticated user. Pagination is supported for retrieving multiple notifications.
 *     security:
 *       - bearerAuth: []
 *     tags:
 *       - Chat
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: ID of the space to update
 *         schema:
 *           type: string
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
router.get("/message/:id", chatIdValidator(), validateHandler, getMessages);

// Get Chat Details, Rename, Delete
/**
 * @swagger
 * /chat/{id}:
 *   get:
 *     summary: Get all Chat Details for the authenticated user
 *     description: This endpoint retrieves all Chat Details associated with the authenticated user. Pagination is supported for retrieving multiple notifications.
 *     security:
 *       - bearerAuth: []
 *     tags:
 *       - Chat
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: ID of the space to update
 *         schema:
 *           type: string
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
router
  .route("/:id")
  .get(chatIdValidator(), validateHandler, getChatDetails)
  .delete(chatIdValidator(), validateHandler, deleteChat);

export { router };
