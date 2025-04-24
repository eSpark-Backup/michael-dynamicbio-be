// poll.routes.ts
import { Router } from "express";
import { PollController } from "../../controllers/account";
import { Poll, PollVote, Post, User } from "../../entity";
import { AppDataSource } from "../../typeorm.config";
import {
    checkJwt,
    setPagination,
    validateRoles,
} from "../../middleware";
import { PollValidation, validate } from "../../validations";
import { ROLES } from "../../constants";

const router = Router();
const userRepository = AppDataSource.getRepository(User);
const postRepository = AppDataSource.getRepository(Post);
const pollRepository = AppDataSource.getRepository(Poll);
const pollVoteRepository = AppDataSource.getRepository(PollVote);

const pollController = new PollController(
    userRepository,
    postRepository,
    pollRepository,
    pollVoteRepository
);

/**
 * @swagger
 * /poll/{pollId}/vote:
 *   post:
 *     summary: Vote on a poll
 *     description: This endpoint allows users to vote on a poll.
 *     security:
 *       - bearerAuth: []
 *     tags:
 *       - Poll
 *     parameters:
 *       - in: path
 *         name: pollId
 *         required: true
 *         description: ID of the poll to vote on
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               optionIndex:
 *                 type: integer
 *                 description: Index of the option to vote for
 *             required:
 *               - optionIndex
 *     responses:
 *       200:
 *         description: Vote recorded successfully
 *       400:
 *         description: Invalid request (e.g., already voted, poll ended)
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Poll not found
 *       500:
 *         description: Server error
 */
router.post(
    "/:pollId/vote",
    checkJwt,
    validateRoles([ROLES.USER]),
    validate(PollValidation.Vote, "body"),
    (req, res, next) => pollController.vote(req, res, next)
);

/**
 * @swagger
 * /poll/{pollId}/results:
 *   get:
 *     summary: Get poll results
 *     description: This endpoint retrieves the results of a poll.
 *     security:
 *       - bearerAuth: []
 *     tags:
 *       - Poll
 *     parameters:
 *       - in: path
 *         name: pollId
 *         required: true
 *         description: ID of the poll to get results for
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Poll results retrieved successfully
 *       403:
 *         description: Results not visible
 *       404:
 *         description: Poll not found
 *       500:
 *         description: Server error
 */
router.get(
    "/:pollId/results",
    checkJwt,
    validateRoles([ROLES.USER]),
    (req, res, next) => pollController.getResults(req, res, next)
);

/**
 * @swagger
 * /poll/{pollId}/option:
 *   post:
 *     summary: Add an option to a poll
 *     description: This endpoint allows users to add a new option to an existing poll if the poll settings allow it.
 *     security:
 *       - bearerAuth: []
 *     tags:
 *       - Poll
 *     parameters:
 *       - in: path
 *         name: pollId
 *         required: true
 *         description: ID of the poll to add an option to
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               option:
 *                 type: string
 *                 description: New option text
 *             required:
 *               - option
 *     responses:
 *       200:
 *         description: Option added successfully
 *       400:
 *         description: Invalid request (e.g., option already exists, poll ended)
 *       403:
 *         description: Adding options not allowed for this poll
 *       404:
 *         description: Poll not found
 *       500:
 *         description: Server error
 */
router.post(
    "/:pollId/option",
    checkJwt,
    validateRoles([ROLES.USER]),
    validate(PollValidation.AddOption, "body"),
    (req, res, next) => pollController.addOption(req, res, next)
);

/**
 * @swagger
 * /poll/{pollId}/end:
 *   post:
 *     summary: End a poll manually
 *     description: This endpoint allows the poll creator to end a poll before its scheduled end date.
 *     security:
 *       - bearerAuth: []
 *     tags:
 *       - Poll
 *     parameters:
 *       - in: path
 *         name: pollId
 *         required: true
 *         description: ID of the poll to end
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Poll ended successfully
 *       400:
 *         description: Poll already ended
 *       403:
 *         description: Only the poll creator can end the poll
 *       404:
 *         description: Poll not found
 *       500:
 *         description: Server error
 */
router.post(
    "/:pollId/end",
    checkJwt,
    validateRoles([ROLES.USER]),
    (req, res, next) => pollController.endPoll(req, res, next)
);

/**
 * @swagger
 * /poll/{pollId}/vote:
 *   delete:
 *     summary: Remove a vote from a poll
 *     description: Allows a user to remove their vote from a specific poll option or all their votes from a poll
 *     security:
 *       - bearerAuth: []
 *     tags:
 *       - Poll
 *     parameters:
 *       - in: path
 *         name: pollId
 *         required: true
 *         description: ID of the poll to remove vote from
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               optionIndex:
 *                 type: integer
 *                 minimum: 0
 *                 description: Index of the specific option to remove vote from. If not provided, all user's votes for this poll will be removed.
 *     responses:
 *       200:
 *         description: Vote removed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Vote removed successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     poll:
 *                       type: object
 *                       description: Poll details
 *                     results:
 *                       type: array
 *                       description: Vote results for each option (only included if poll is configured to show results)
 *                     userVote:
 *                       type: integer
 *                       nullable: true
 *                       description: The user's current vote (if any remains)
 *                     userVotes:
 *                       type: array
 *                       description: All of the user's current votes (only included if multiple votes are allowed)
 *                     hasVoted:
 *                       type: boolean
 *                       description: Whether the user still has any votes on this poll
 *                     pollStats:
 *                       type: object
 *                       properties:
 *                         totalVotes:
 *                           type: integer
 *                           description: Total number of votes on this poll
 *                         hasEnded:
 *                           type: boolean
 *                           description: Whether the poll has ended
 *       400:
 *         description: Bad request - Poll has ended or other validation error
 *       401:
 *         description: Unauthorized - User not authenticated
 *       403:
 *         description: Forbidden - User not authorized to perform this action
 *       404:
 *         description: Not found - Poll not found or no votes to remove
 *       500:
 *         description: Server error
 */
router.delete(
    "/:pollId/vote",
    checkJwt,
    validateRoles([ROLES.USER]),
    validate(PollValidation.RemoveVote, "body"),
    (req, res, next) => pollController.removeVote(req, res, next)
);

export { router };