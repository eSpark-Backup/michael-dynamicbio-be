import { Router } from "express";
import Joi from "joi";
import {
  AuthValidation,
  PostValidation,
  UserValidation,
  validate,
} from "../../validations";
import { PostController, UserController } from "../../controllers/account";
import { Likes, Post, User } from "../../entity";
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
const postRepository = AppDataSource.getRepository(Post);
const likeRepository = AppDataSource.getRepository(Likes);

const postController = new PostController(userRepository, postRepository,likeRepository);

/**
 * @swagger
 * /post/{id}/schedule:
 *   post:
 *     summary: Schedule a post for future publication
 *     description: This endpoint allows users to schedule a post for future publication
 *     security:
 *       - bearerAuth: []
 *     tags:
 *       - Post
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: ID of the post to schedule
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               scheduledDate:
 *                 type: string
 *                 format: date-time
 *                 description: Date and time when the post should be published
 *             required:
 *               - scheduledDate
 *     responses:
 *       200:
 *         description: Post scheduled successfully
 *       400:
 *         description: Invalid scheduled date
 *       404:
 *         description: Post not found
 *       403:
 *         description: User not authorized to schedule this post
 *       500:
 *         description: Server error
 */
router.post(
    "/:id/schedule",
    checkJwt,
    validateRoles([ROLES.USER]),
    validate(PostValidation.SchedulePost, "body"),
    (req, res, next) => postController.schedulePost(req, res, next)
);

/**
 * @swagger
 * /post/{id}/schedule:
 *   delete:
 *     summary: Cancel a scheduled post
 *     description: This endpoint allows users to cancel a scheduled post
 *     security:
 *       - bearerAuth: []
 *     tags:
 *       - Post
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: ID of the scheduled post to cancel
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Scheduled post canceled successfully
 *       400:
 *         description: Post is not scheduled
 *       404:
 *         description: Post not found
 *       403:
 *         description: User not authorized to cancel this scheduled post
 *       500:
 *         description: Server error
 */
router.delete(
    "/:id/schedule",
    checkJwt,
    validateRoles([ROLES.USER]),
    (req, res, next) => postController.cancelScheduledPost(req, res, next)
);

/**
 * @swagger
 * /post/{id}/schedule:
 *   put:
 *     summary: Update a scheduled post
 *     description: This endpoint allows users to update the scheduled time of a post
 *     security:
 *       - bearerAuth: []
 *     tags:
 *       - Post
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: ID of the scheduled post to update
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               scheduledDate:
 *                 type: string
 *                 format: date-time
 *                 description: New date and time when the post should be published
 *             required:
 *               - scheduledDate
 *     responses:
 *       200:
 *         description: Scheduled post updated successfully
 *       400:
 *         description: Invalid scheduled date or post is not scheduled
 *       404:
 *         description: Post not found
 *       403:
 *         description: User not authorized to update this scheduled post
 *       500:
 *         description: Server error
 */
router.put(
    "/:id/schedule",
    checkJwt,
    validateRoles([ROLES.USER]),
    validate(PostValidation.SchedulePost, "body"),
    (req, res, next) => postController.updateScheduledPost(req, res, next)
);


/**
 * @swagger
 * /post/scheduled:
 *   get:
 *     summary: Get all scheduled posts for the authenticated user
 *     description: This endpoint retrieves all scheduled posts for the authenticated user
 *     security:
 *       - bearerAuth: []
 *     tags:
 *       - Post
 *     parameters:
 *       - in: query
 *         name: page
 *         required: false
 *         description: Page number for pagination
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: pageSize
 *         required: false
 *         description: Number of items per page
 *         schema:
 *           type: integer
 *           default: 10
 *     responses:
 *       200:
 *         description: Scheduled posts retrieved successfully
 *       500:
 *         description: Server error
 */
router.get(
    "/scheduled",
    checkJwt,
    validateRoles([ROLES.USER]),
    setPagination,
    (req, res, next) => postController.getScheduledPosts(req, res, next)
);


/**
 * @swagger
 * /post/{id}:
 *   put:
 *     summary: Update an existing post
 *     description: This endpoint allows users with the USER role to update an existing post.
 *     security:
 *       - bearerAuth: []
 *     tags:
 *       - Post
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: ID of the post to update
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               content:
 *                  type: object
 *                  properties:
 *                    description:
 *                       type: string
 *                       description: A brief description of the post
 *                    htmlContent:
 *                       type: string
 *                       description: HTML content related to the post (e.g., description with HTML tags)
 *               status:
 *                 type: string
 *                 enum:
 *                   - PUBLISH
 *                   - DRAFT
 *                   - ARCHIVE
 *               visibility:
 *                 type: string
 *                 enum:
 *                   - PUBLIC
 *                   - CONNECTIONS
 *                   - ONLY_ME
 *                   - GROUPS
 *                   - FOLLOWERS
 *               type:
 *                 type: string
 *                 enum:
 *                   - TEXT
 *                   - IMAGE
 *                   - VIDEO
 *                   - ARTICLE
 *                   - POLL
 *                   - EVENT
 *               images:
 *                 type: array
 *                 required: false
 *                 items:
 *                   type: string
 *                   format: binary
 *                 description: Array of cover images for the post.
 *               imageKeys:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Array of cover keys for the post.
 *               videos:
 *                 type: array
 *                 required: false
 *                 items:
 *                   type: string
 *                   format: binary
 *                 description: Array of video files for the post.
 *               videoKeys:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Array of cover keys for the post.
 *               thumbnails:
 *                 type: array
 *                 required: false
 *                 items:
 *                   type: string
 *                   format: binary
 *                 description: Array of video thumbnails files for the post.
 *               thumbnailKeys:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Array of cover keys for the post.
 *               cover:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Post updated successfully.
 *       400:
 *         description: Validation error.
 *       403:
 *         description: Forbidden.
 *       404:
 *         description: Post not found.
 *       500:
 *         description: Server error.
 */
router.put(
    "/:id",
    checkJwt,
    validateRoles([ROLES.USER]),
    handleMultipleFiles([
        { name: FILE_FIELDS.IMAGE, maxCount: 10 },
        { name: FILE_FIELDS.VIDEO, maxCount: 5 },
        { name: FILE_FIELDS.THUMBNAIL, maxCount: 5 },
        { name: FILE_FIELDS.COVER, maxCount: 1 },
    ]),
    parseJsonFields(["content"]),
    validate(PostValidation.UpdatePost, "body"),
    (req, res, next) => postController.updatePost(req, req as any, res, next)
);

/**
 * @swagger
 * /post/{id}:
 *   get:
 *     summary: Get a specific post by ID or all posts for the authenticated user
 *     description: This endpoint retrieves a specific post by its ID (if provided) or all posts associated with the authenticated user. Pagination is supported for retrieving multiple posts.
 *     security:
 *       - bearerAuth: []
 *     tags:
 *       - Post
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
    "/:id",
    checkJwt,
    validateRoles([ROLES.USER]),
    setPagination,
    (req, res, next) => postController.getAllPost(req, res, next)
);


/**
 * @swagger
 * /post:
 *   post:
 *     summary: Create a new post
 *     description: This endpoint allows users with the USER role to create a new post, with optional scheduling for later publication.
 *     security:
 *       - bearerAuth: []
 *     tags:
 *       - Post
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               content:
 *                  type: object
 *                  required: false
 *                  properties:
 *                    description:
 *                       type: string
 *                       description: A brief description of the post
 *                    htmlContent:
 *                       type: string
 *                       description: HTML content related to the post (e.g., description with HTML tags)
 *               status:
 *                 type: string
 *                 enum:
 *                   - PUBLISH
 *                   - DRAFT
 *                   - ARCHIVE
 *                   - SCHEDULED
 *                 description: The status of the post. Use SCHEDULED to schedule a post for later publication.
 *               scheduledDate:
 *                 type: string
 *                 format: date-time
 *                 description: Date and time when the post should be published. Required when status is SCHEDULED. Must be in ISO format and in the future.
 *                 example: "2025-04-15T14:30:00Z"
 *               visibility:
 *                 type: string
 *                 enum:
 *                   - PUBLIC
 *                   - CONNECTIONS
 *                   - ONLY_ME
 *                   - GROUPS
 *                   - FOLLOWERS
 *               type:
 *                 type: string
 *                 enum:
 *                   - TEXT
 *                   - IMAGE
 *                   - VIDEO
 *                   - ARTICLE
 *                   - POLL
 *                   - EVENT
 *               imageOrder:
 *                  type: array
 *                  required: false
 *                  items:
 *                    type: string
 *                  description: Array specifying the order of cover filenames.
 *               images:
 *                 type: array
 *                 required: false
 *                 items:
 *                   type: string
 *                   format: binary
 *                 description: Array of cover images for the post.
 *               videos:
 *                 type: array
 *                 required: false
 *                 items:
 *                   type: string
 *                   format: binary
 *                 description: Array of video files for the post.
 *               thumbnails:
 *                 type: array
 *                 required: false
 *                 items:
 *                   type: string
 *                   format: binary
 *                 description: Array of video thumbnails files for the post.
 *               cover:
 *                 type: string
 *                 format: binary
 *     responses:
 *       201:
 *         description: Post created successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Post Created Successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       description: The post ID
 *                     content:
 *                       type: object
 *                       description: Post content
 *                     status:
 *                       type: string
 *                       description: Post status (PUBLISH, DRAFT, ARCHIVE, SCHEDULED)
 *                     scheduledFor:
 *                       type: string
 *                       format: date-time
 *                       description: Scheduled publication date (only when status is SCHEDULED)
 *                     scheduledJobId:
 *                       type: string
 *                       description: ID of the scheduled job (only when status is SCHEDULED)
 *                     media:
 *                       type: object
 *                       description: Media attached to the post
 *                     author:
 *                       type: object
 *                       description: Information about the post author
 *       400:
 *         description: Validation error.
 *       403:
 *         description: Forbidden.
 *       500:
 *         description: Server error.
 */
router.post(
  "",
  checkJwt,
  validateRoles([ROLES.USER]),
  handleMultipleFiles([
    { name: FILE_FIELDS.IMAGE, maxCount: 10 },
    { name: FILE_FIELDS.VIDEO, maxCount: 5 },
    { name: FILE_FIELDS.THUMBNAIL, maxCount: 5 },
    { name: FILE_FIELDS.COVER, maxCount: 1 },
  ]),

  parseJsonFields(["content"]),
  validate(PostValidation.CreatePost, "body"),
  (req, res, next) => postController.createPost(req, req as any, res, next)
);




export { router };
