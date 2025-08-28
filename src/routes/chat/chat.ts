import express, { Router } from "express";
import {
  deleteChat,
  getChatDetails,
  getMessages,
  getMyChats,
  sendAttachments,
  addMembers,
  newGroupChat,
  removeMember,
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


/**
 * @swagger
 * /chat/group/create:
 *   post:
 *     summary: Create a new group chat
 *     description: Create a new group chat with given members and creator.
 *     security:
 *       - bearerAuth: []
 *     tags:
 *       - Chat
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 example: "My Awesome Group"
 *               members:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: ["userId1", "userId2"]
 *     responses:
 *       201:
 *         description: Group chat created successfully.
 *       400:
 *         description: Bad request or missing fields.
 *       500:
 *         description: Server error.
 */
router.post("/group/create", newGroupChat);

/**
 * @swagger
 * /chat/group/member/add:
 *   put:
 *     summary: Add members to a group chat
 *     description: Only the group creator can add members to the group chat.
 *     security:
 *       - bearerAuth: []
 *     tags:
 *       - Chat
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               chatId:
 *                 type: string
 *               members:
 *                 type: array
 *                 items:
 *                   type: string
 *             example:
 *               chatId: "abc123"
 *               members: ["user123", "user456"]
 *     responses:
 *       200:
 *         description: Members added successfully.
 *       400:
 *         description: Invalid input or limit reached.
 *       403:
 *         description: Not authorized to add members.
 *       404:
 *         description: Chat not found.
 */
router.put("/group/member/add", addMembers);

/**
 * @swagger
 * /chat/group/member/remove:
 *   delete:
 *     summary: Remove a member from a group chat
 *     description: Only the group creator can remove members from the group chat.
 *     security:
 *       - bearerAuth: []
 *     tags:
 *       - Chat
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               chatId:
 *                 type: string
 *               userId:
 *                 type: string
 *             example:
 *               chatId: "abc123"
 *               userId: "user123"
 *     responses:
 *       200:
 *         description: Member removed successfully.
 *       400:
 *         description: Group has minimum number of members or bad input.
 *       403:
 *         description: Not authorized to remove members.
 *       404:
 *         description: Chat or user not found.
 */
router.delete("/group/member/remove", removeMember);






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
