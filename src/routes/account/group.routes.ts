import {
  checkJwt,
  handleMultipleFiles,
  setPagination,
  validateRoles,
} from "../../middleware";
import { User, Group, GroupJoinRequest, GroupPostRequest } from "../../entity";
import { AppDataSource } from "../../typeorm.config";
import { Router } from "express";
import { ROLES, FILE_FIELDS } from "../../constants";
import { GroupValidation, validate } from "../../validations";
import { GroupController } from "../../controllers";
import { Notification } from "../../models";

const router = Router();
const userRepository = AppDataSource.getRepository(User);
const groupRepository = AppDataSource.getRepository(Group);
const groupJoinRequestRepository =
  AppDataSource.getRepository(GroupJoinRequest);
  const groupPostRequestRepository =
  AppDataSource.getRepository(GroupPostRequest);

const groupController = new GroupController(
  userRepository,
  groupRepository,
  Notification,
  groupJoinRequestRepository,
  groupPostRequestRepository
);

/**
 * @swagger
 * /group:
 *   post:
 *     summary: Create a new Group
 *     description: Creates a new group with the provided details. Different fields are required based on industry type.
 *     security:
 *       - bearerAuth: []
 *     tags:
 *       - Group
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - status
 *               - address
 *               - rules
 *               - industry
 *             properties:
 *               name:
 *                 type: string
 *                 description: Name of the group
 *               rules:
 *                 type: string
 *                 description: Name of the group
 *               status:
 *                 type: string
 *                 enum: [PUBLIC,PRIVATE]
 *                 description: Status of the group
 *               address:
 *                 type: string
 *                 description: Address of the group
 *               industry:
 *                 type: string
 *                 enum: [PRODUCTION, TRANSPORTATION, STORAGE, TECHNOLOGY, FINANCE, EDUCATION, HEALTHCARE, RETAIL, OTHER]
 *                 description: Industry type of the group
 *               logo:
 *                 type: string
 *                 format: binary
 *                 description: Logo image for the group
 *               cover:
 *                 type: string
 *                 format: binary
 *                 description: Cover image for the group
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
  validate(GroupValidation.createGroup, "body"),
  (req, res, next) => groupController.createGroup(req, req as any, res, next)
);

/**
 * @swagger
 * /group/{id}:
 *   put:
 *     summary: Update an existing group
 *     description: Updates an existing group with the provided details. User must be an admin of the page.
 *     security:
 *       - bearerAuth: []
 *     tags:
 *       - Group
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: ID of the group to update
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
 *                 description: Name of the group
 *               rules:
 *                 type: string
 *                 description: Name of the group
 *               status:
 *                 type: string
 *                 enum: [PUBLIC,PRIVATE]
 *                 description: Status of the group
 *               address:
 *                 type: string
 *                 description: Address of the group
 *               industry:
 *                 type: string
 *                 enum: [PRODUCTION, TRANSPORTATION, STORAGE, TECHNOLOGY, FINANCE, EDUCATION, HEALTHCARE, RETAIL, OTHER]
 *                 description: Industry type of the group
 *               logo:
 *                 type: string
 *                 format: binary
 *                 description: Logo image for the group
 *               cover:
 *                 type: string
 *                 format: binary
 *                 description: Cover image for the group
 *     responses:
 *       200:
 *         description: Group updated successfully
 *       400:
 *         description: Validation error or bad request
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - User is not an admin of the group
 *       404:
 *         description: group not found
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
  validate(GroupValidation.updateGroup, "body"),
  (req, res, next) => groupController.updateGroup(req, req as any, res, next)
);

/**
 * @swagger
 * /group/{id}:
 *   delete:
 *     summary: Delete a group
 *     description: Deletes a group by its ID. User must be an admin of the group.
 *     security:
 *       - bearerAuth: []
 *     tags:
 *       - Group
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: ID of the group to delete
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Group deleted successfully
 *       400:
 *         description: Validation error or bad request
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - User is not an admin of the group
 *       404:
 *         description: Group not found
 */

router.delete("/:id", checkJwt, validateRoles([ROLES.USER]), (req, res, next) =>
  groupController.deleteGroup(req, res, next)
);

/**
 * @swagger
 * /group/user/my:
 *   get:
 *     summary: Get groups where the current user is admin or creator
 *     description: Retrieves groups where the current user is either an admin or the creator.
 *     security:
 *       - bearerAuth: []
 *     tags:
 *       - Group
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
 *         description: Group retrieved successfully
 *       500:
 *         description: Server error
 */
router.get(
  "/user/my",
  checkJwt,
  validateRoles([ROLES.USER]),
  setPagination,
  (req, res, next) => groupController.getAllGroupsOfUser(req, res, next)
);

/**
 * @swagger
 * /group/{id}:
 *   get:
 *     summary: Get a group by ID
 *     description: Retrieves a group by its ID with details about followers, admins, etc.
 *     security:
 *       - bearerAuth: []
 *     tags:
 *       - Group
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: ID of the group to retrieve
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Group retrieved successfully
 *       404:
 *         description: Group not found
 *       500:
 *         description: Server error
 */
router.get("/:id", checkJwt, validateRoles([ROLES.USER]), (req, res, next) =>
  groupController.getGroupById(req, res, next)
);


/**
 * @swagger
 * /group:
 *   get:
 *     summary: Get groups with pagination and filtering
 *     description: Retrieves groups with pagination and optional filtering by type and industry.
 *     security:
 *       - bearerAuth: []
 *     tags:
 *       - Group
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
 *         description: Groups retrieved successfully
 *       500:
 *         description: Server error
 */
router.get(
  "",
  checkJwt,
  validateRoles([ROLES.USER]),
  setPagination,
  (req, res, next) => groupController.getGroups(req, res, next)
);

/**
 * @swagger
 * /group/follow/{id}:
 *   post:
 *     summary: Send join request to a group
 *     description: Sends a join request to a group. If already a member or request is pending, it responds accordingly.
 *     security:
 *       - bearerAuth: []
 *     tags:
 *       - Group
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: ID of the group to follow (send join request)
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Join request status
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     requestSent:
 *                       type: boolean
 *                     joined:
 *                       type: boolean
 *                     pending:
 *                       type: boolean
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: User or Group not found
 *       500:
 *         description: Server error
 */

router.post(
  "/follow/:id",
  checkJwt,
  validateRoles([ROLES.USER]),
  (req, res, next) => groupController.followGroup(req, res, next)
);


/**
 * @swagger
 * /group/request/approve/{requestId}:
 *   post:
 *     summary: Approve a group join request
 *     description: Approves a pending group join request and adds the user as a follower.
 *     security:
 *       - bearerAuth: []
 *     tags:
 *       - Group
 *     parameters:
 *       - in: path
 *         name: requestId
 *         required: true
 *         description: ID of the join request to approve
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Join request approved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     approved:
 *                       type: boolean
 *       400:
 *         description: Invalid or already approved request
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Request not found
 *       500:
 *         description: Server error
 */

router.post(
  "/request/approve/:requestId",
  checkJwt,
  validateRoles([ROLES.USER]),
  (req, res, next) => groupController.approveGroupJoinRequest(req, res, next)
);


/**
 * @swagger
 * /group/request/pending/{groupId}:
 *   get:
 *     summary: Get all pending join requests for a group
 *     description: Returns a list of users who have requested to join the group but are not yet approved.
 *     security:
 *       - bearerAuth: []
 *     tags:
 *       - Group
 *     parameters:
 *       - in: path
 *         name: groupId
 *         required: true
 *         description: ID of the group to fetch pending requests for
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Pending group join requests fetched successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Pending group join requests fetched successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     pendingRequests:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                           user:
 *                             type: object
 *                             properties:
 *                               id:
 *                                 type: string
 *                               fullName:
 *                                 type: string
 *                               email:
 *                                 type: string
 *                           group:
 *                             type: object
 *                             properties:
 *                               id:
 *                                 type: string
 *                               name:
 *                                 type: string
 *                           isApproved:
 *                             type: boolean
 *                           createdAt:
 *                             type: string
 *                             format: date-time
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - not an admin or group creator
 *       404:
 *         description: Group not found
 *       500:
 *         description: Server error
 */
router.get(
  "/request/pending/:groupId",
  checkJwt,
  validateRoles([ROLES.USER]),
  (req, res, next) =>
    groupController.getPendingRequests(req, res, next)
);



/**
 * @swagger
 * /group/user/followed:
 *   get:
 *     summary: Get groups followed by the current user
 *     description: Retrieves groups that the current user follows.
 *     security:
 *       - bearerAuth: []
 *     tags:
 *       - Group
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
 *         description: Followed group retrieved successfully
 *       500:
 *         description: Server error
 */
router.get(
  "/user/followed",
  checkJwt,
  validateRoles([ROLES.USER]),
  setPagination,
  (req, res, next) => groupController.getFollowedGroups(req, res, next)
);


/**
 * @swagger
 * /group/{groupId}/posts/pending:
 *   get:
 *     summary: Fetch all pending post requests for a group
 *     tags:
 *       - Group
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: groupId
 *         schema:
 *           type: string
 *         required: true
 *         description: ID of the group
 *     responses:
 *       200:
 *         description: Successfully fetched all pending group post requests
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Fetched all pending group post requests
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                         format: uuid
 *                       isApproved:
 *                         type: boolean
 *                       rejectionReason:
 *                         type: string
 *                         nullable: true
 *                       user:
 *                         $ref: '#/components/schemas/User'
 *                       post:
 *                         $ref: '#/components/schemas/Post'
 *                       group:
 *                         $ref: '#/components/schemas/Group'
 *       403:
 *         description: Forbidden - not an admin or creator of the group
 *       404:
 *         description: Group not found
 */
router.get(
  "/:groupId/posts/pending",
  checkJwt,
  validateRoles([ROLES.USER]),
  (req, res, next) =>
    groupController.fetchAllPendingPosts(req, res, next)
);


/**
 * @swagger
 * /group/posts/{requestId}/action:
 *   patch:
 *     summary: Approve or reject a group post request
 *     tags:
 *       - Group
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: requestId
 *         schema:
 *           type: string
 *         required: true
 *         description: ID of the group post request
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               action:
 *                 type: string
 *                 enum: [approve, reject]
 *                 example: approve
 *                 description: Action to perform on the post request
 *               rejectionReason:
 *                 type: string
 *                 example: This post violates group rules
 *                 nullable: true
 *                 description: Reason for rejection (required if action is 'reject')
 *             required:
 *               - action
 *     responses:
 *       200:
 *         description: Post request has been successfully approved or rejected
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Post request has been approved successfully
 *       400:
 *         description: Bad request - missing or invalid input
 *       403:
 *         description: Forbidden - not authorized
 *       404:
 *         description: Group post request not found
 */

router.patch(
  "/posts/:requestId/action",
  checkJwt,
  validateRoles([ROLES.USER]),
  (req, res, next) =>
    groupController.approveOrRejectPost(req, res, next)
);


/**
 * @swaggerBeta
 * /group/{id}/admin:
 *   post:
 *     summary: Add a user as admin to a group
 *     description: Adds a user as admin to a group. Current user must be an admin.
 *     security:
 *       - bearerAuth: []
 *     tags:
 *       - Group
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: ID of the group
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
 *         description: Group or user not found
 *       500:
 *         description: Server error
 */
router.post(
  "/:id/admin",
  checkJwt,
  validateRoles([ROLES.USER]),
  validate(GroupValidation.addAdmin, "body"),
  (req, res, next) => groupController.addAdmin(req, res, next)
);

/**
 * @swaggerBeta
 * /group/{id}/admin:
 *   delete:
 *     summary: Remove a user as admin from a group
 *     description: Removes a user as admin from a group. Only the group creator can remove admins.
 *     security:
 *       - bearerAuth: []
 *     tags:
 *       - Group
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: ID of the group
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
  validate(GroupValidation.addAdmin, "body"),
  (req, res, next) => groupController.removeAdmin(req, res, next)
);
export { router };
