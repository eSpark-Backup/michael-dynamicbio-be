import { Router } from "express";
import Joi from "joi";
import { AuthValidation, PostValidation, UserValidation, validate } from "../../validations";
import { PostController, UserController } from "../../controllers/account";
import { Post, User } from "../../entity";
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


const postController = new PostController(
  userRepository,
  postRepository
);



/**
 * @swagger
 * /post:
 *   post:
 *     summary: Create a new post
 *     description: This endpoint allows users with the USER role to create a new post.
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
 *     responses:
 *       201:
 *         description: Post created successfully.
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
      { name: FILE_FIELDS.VIDEO, maxCount: 5 }, // Handle videos

    ]),
    
    parseJsonFields(["content"]),
    validate(PostValidation.CreatePost, "body"),
    (req, res, next) => postController.createPost(req, req as any, res, next)
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
  "/:id?",
  checkJwt,
  validateRoles([ROLES.USER]),
  setPagination,
  (req, res, next) => postController.getAllPost(req, res, next)
);




export { router };
