import { Router } from "express";
import Joi from "joi";
import {
  AuthValidation,
  PostValidation,
  UserValidation,
  validate,
} from "../../validations";
import { InteractionController } from "../../controllers/account";
import { Post, User, Likes, Comments } from "../../entity";
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
const commentRepository = AppDataSource.getRepository(Comments);

const interactionController = new InteractionController(
  userRepository,
  postRepository,
  likeRepository,
  commentRepository
);

/**
 * @swagger
 * /interaction/like:
 *   post:
 *     summary: Toggle like on a post
 *     description: This endpoint allows users to like or unlike a post.
 *     security:
 *       - bearerAuth: []
 *     tags:
 *       - Interaction
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               entityId:
 *                 type: string
 *                 description: The ID of the post to like/unlike
 *               type:
 *                 type: string
 *                 enum:
 *                   - POST
 *                   - COMMENT
 *                 description: The type of entity (e.g., POST, COMMENT)
 *     responses:
 *       '200':
 *         description: Like removed successfully
 *       '201':
 *         description: Like added successfully
 *       '400':
 *         description: Invalid request body
 *       '404':
 *         description: Entity not found
 *       '500':
 *         description: Internal server error
 */

router.post("/like", checkJwt, validateRoles([ROLES.USER]), (req, res, next) =>
  interactionController.toggleLike(req, res, next)
);

/**
 * @swagger
 * /interaction/comments/{postId}:
 *   get:
 *     summary: Get all comments by postId
 *     description: This endpoint allows users to fetch all comments and their replies for a specific post.
 *     security:
 *       - bearerAuth: []
 *     tags:
 *       - Interaction
 *     parameters:
 *       - in: path
 *         name: postId
 *         required: true
 *         description: The ID of the post to fetch comments for
 *         schema:
 *           type: string
 *     responses:
 *       '200':
 *         description: Comments and replies fetched successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 message:
 *                   type: string
 *                   example: Comments fetched successfully
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                         description: Comment ID
 *                       content:
 *                         type: string
 *                         description: Content of the comment
 *                       user:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: integer
 *                             description: User ID
 *                           name:
 *                             type: string
 *                             description: Name of the user who commented
 *                       replies:
 *                         type: array
 *                         items:
 *                           type: object
 *                           properties:
 *                             id:
 *                               type: integer
 *                               description: Reply ID
 *                             content:
 *                               type: string
 *                               description: Content of the reply
 *                             user:
 *                               type: object
 *                               properties:
 *                                 id:
 *                                   type: integer
 *                                   description: User ID
 *                                 name:
 *                                   type: string
 *                                   description: Name of the user who replied
 *       '404':
 *         description: Post not found
 *       '500':
 *         description: Internal server error
 */
router.get(
  "/comments/:postId",
  checkJwt,
  validateRoles([ROLES.USER]),
  (req, res, next) => interactionController.getCommentsByPostId(req, res, next)
);



/**
 * @swagger
 * /interaction/comments:
 *   post:
 *     summary: Create a comment on a post
 *     description: This endpoint allows users to create a comment on a post, including replies to existing comments.
 *     security:
 *       - bearerAuth: []
 *     tags:
 *       - Interaction
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               content:
 *                 type: string
 *                 description: The content of the comment
 *                 example: "This is a great post!"
 *               postId:
 *                 type: string
 *                 description: The ID of the post on which to comment
 *                 example: "12345"
 *               parentCommentId:
 *                 type: string
 *                 description: The ID of the parent comment, if it's a reply to an existing comment (optional)
 *                 example: "67890"
 *     responses:
 *       '201':
 *         description: Comment created successfully
 *       '400':
 *         description: Invalid request body or missing required fields
 *       '404':
 *         description: Post or Parent Comment not found
 *       '500':
 *         description: Internal server error
 */
router.post("/comments", checkJwt, validateRoles([ROLES.USER]), (req, res, next) =>
    interactionController.createCommentOnPost(req, res, next)
  );
  
export { router };
