import { checkJwt, handleMultipleFiles, validateRoles } from "../../middleware";
import { User, Group } from "../../entity";
import { AppDataSource } from "../../typeorm.config";
import { Router } from "express";
import { ROLES, FILE_FIELDS } from "../../constants";
import { GroupValidation, validate } from "../../validations";
import { GroupController } from "../../controllers";
import { Notification } from "../../models";

const router = Router();
const userRepository = AppDataSource.getRepository(User);
const groupRepository = AppDataSource.getRepository(Group);

const groupController = new GroupController(
  userRepository,
  groupRepository,
  Notification
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

router.delete(
    "/:id",
    checkJwt,
    validateRoles([ROLES.USER]),
    (req, res, next) => groupController.deleteGroup(req, res, next)
    );


export { router };
