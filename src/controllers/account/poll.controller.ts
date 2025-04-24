import { NextFunction, Response } from "express";
import { Poll, PollVote, Post, PostStatus, PostType, User } from "../../entity";
import { ICustomRequest } from "../../interfaces";
import { Repository } from "typeorm";
import { ApiError } from "../../errors";
import { HTTP_STATUS } from "../../constants";
import { handleResponse, logger } from "../../utils";
import { Notification } from "../../models";

export class PollController {
    constructor(
        private usersRepo: Repository<User>,
        private postRepo: Repository<Post>,
        private pollRepo: Repository<Poll>,
        private pollVoteRepo: Repository<PollVote>
    ) {}

    async vote(
        req: ICustomRequest,
        res: Response,
        next: NextFunction
    ): Promise<void> {
        try {
            const { pollId } = req.params;
            const { optionIndex } = req.body;
            const userId = req.user?.id;

            // Find the poll
            const poll = await this.pollRepo.findOne({
                where: { id: pollId },
                relations: ["post", "post.author", "votes", "votes.user"]
            });

            if (!poll) {
                throw new ApiError("Poll not found", HTTP_STATUS.NOT_FOUND);
            }

            // Check if poll has ended
            if (poll.endDate && new Date() > poll.endDate) {
                throw new ApiError("Poll has ended", HTTP_STATUS.BAD_REQUEST);
            }

            // Validate option index
            if (optionIndex < 0 || optionIndex >= poll.options.length) {
                throw new ApiError("Invalid option index", HTTP_STATUS.BAD_REQUEST);
            }

            // Get all options the user has voted on
            const userVotedOptions = this.getUserPollVotes(poll, userId);

            // Check if user has already voted on this specific option
            if (userVotedOptions.includes(optionIndex)) {
                throw new ApiError(
                    "You have already voted on this option",
                    HTTP_STATUS.BAD_REQUEST
                );
            }

            // Check if user has already voted on any option and multiple votes are not allowed
            if (!poll.allowMultipleVotes && userVotedOptions.length > 0) {
                throw new ApiError(
                    "You have already voted on this poll",
                    HTTP_STATUS.BAD_REQUEST
                );
            }

            // Create and save vote
            const vote = new PollVote();
            vote.pollId = pollId;
            vote.userId = userId;
            vote.optionIndex = optionIndex;
            await this.pollVoteRepo.save(vote);

            // Reload poll with the new vote
            const updatedPoll = await this.pollRepo.findOne({
                where: { id: pollId },
                relations: ["post", "post.author", "votes"]
            });

            // Get vote counts for response
            const voteCounts = await this.getPollVoteCounts(updatedPoll);

            // Determine user's votes
            const userVotes = this.getUserPollVotes(updatedPoll, userId);
            const hasVoted = userVotes.length > 0;

            // Calculate poll statistics
            const pollStats = {
                totalVotes: updatedPoll.votes.length,
                hasEnded: updatedPoll.endDate ? new Date() > updatedPoll.endDate : false
            };

            // Create notification for poll creator if it's not the voter
            if (updatedPoll.post.author.id !== userId) {
                try {
                    await Notification.create({
                        user: updatedPoll.post.author.userChatId,
                        title: "New Poll Vote",
                        message: `Someone voted on your poll: "${updatedPoll.question}"`,
                        type: "info",
                        metadata: {
                            postId: updatedPoll.post.id,
                            pollId: updatedPoll.id
                        }
                    });
                } catch (error) {
                    logger.error(`Failed to create notification: ${(error as Error).message}`);
                    // Don't fail the entire request if notification creation fails
                }
            }

            // Remove sensitive data if poll is anonymous
            if (updatedPoll.isAnonymous) {
                delete updatedPoll.votes;
            }

            // Return consistent response structure
            res.status(HTTP_STATUS.OK).json(
                handleResponse("Vote recorded successfully", {
                    poll: updatedPoll,
                    results: updatedPoll.showResults ? voteCounts : null,
                    userVote: userVotes.length > 0 ? userVotes[userVotes.length - 1] : null,  // Return most recent vote
                    userVotes: poll.allowMultipleVotes ? userVotes : undefined,  // Only include if multiple votes allowed
                    hasVoted: hasVoted,
                    pollStats: pollStats
                })
            );
        } catch (error) {
            logger.error(
                `PollController :: vote :: ${(error as Error)?.message}`
            );
            return next(error);
        }
    }

    async getPollResults(poll: Poll) {
        // Get all votes for this poll
        const votes = await this.pollVoteRepo.find({
            where: { pollId: poll.id }
        });

        // Count votes for each option
        const voteCounts = poll.options.map((_, index) => ({
            count: votes.filter(vote => vote.optionIndex === index).length,
            percentage: 0
        }));

        // Calculate percentages
        const totalVotes = votes.length;
        if (totalVotes > 0) {
            voteCounts.forEach(option => {
                option.percentage = Math.round((option.count / totalVotes) * 100);
            });
        }

        return voteCounts;
    }

    async getResults(
        req: ICustomRequest,
        res: Response,
        next: NextFunction
    ): Promise<void> {
        try {
            const { pollId } = req.params;
            const userId = req.user?.id;

            // Find the poll
            const poll = await this.pollRepo.findOne({
                where: { id: pollId },
                relations: ["post", "post.author", "votes"]
            });

            if (!poll) {
                throw new ApiError("Poll not found", HTTP_STATUS.NOT_FOUND);
            }

            // Check if results should be visible
            const hasEnded = poll.endDate && new Date() > poll.endDate;
            const userVotes = this.getUserPollVotes(poll, userId);
            const hasVoted = userVotes.length > 0;

            // Determine if results should be shown
            // Show if: poll is configured to show results OR poll has ended OR user has voted
            if (!poll.showResults && !hasEnded && !hasVoted) {
                throw new ApiError(
                    "Poll results are not visible",
                    HTTP_STATUS.FORBIDDEN
                );
            }

            // Get vote counts
            const voteCounts = await this.getPollVoteCounts(poll);

            // Calculate poll statistics
            const pollStats = {
                totalVotes: poll.votes.length,
                hasEnded: hasEnded
            };

            // Remove sensitive data if poll is anonymous
            if (poll.isAnonymous) {
                delete poll.votes;
            }

            res.status(HTTP_STATUS.OK).json(
                handleResponse("Poll results retrieved successfully", {
                    poll,
                    results: voteCounts,
                    userVote: userVotes.length > 0 ? userVotes[userVotes.length - 1] : null, // Most recent vote
                    userVotes: poll.allowMultipleVotes ? userVotes : undefined, // Only include if multiple votes allowed
                    hasVoted: hasVoted,
                    pollStats: pollStats
                })
            );
        } catch (error) {
            logger.error(
                `PollController :: getResults :: ${(error as Error)?.message}`
            );
            return next(error);
        }
    }

// Helper method to check if a user has voted on a poll and return their vote
    private getUserPollVote(poll: Poll, userId: string): number | null {
        if (!poll || !poll.votes || !userId) {
            return null;
        }

        // Find the user's vote
        const userVote = poll.votes.find(vote => vote.userId === userId);

        // Return the option index if found, otherwise null
        return userVote ? userVote.optionIndex : null;
    }

// Helper method to calculate poll vote statistics
    private async getPollVoteCounts(poll: Poll): Promise<any[]> {
        if (!poll || !poll.options) {
            return [];
        }

        // Get all votes for this poll with user details
        const votes = await this.pollVoteRepo.find({
            where: { pollId: poll.id },
            relations: ["user"]
        });

        const totalVotes = votes.length;

        // Count votes for each option
        const voteCounts = poll.options.map((option, index) => {
            const optionVotes = votes.filter(vote => vote.optionIndex === index);

            // Get user details for each vote if the poll is not anonymous
            const voteDetails = poll.isAnonymous ? [] : optionVotes.map(vote => ({
                userId: vote.userId,
                firstName: vote.user.firstName,
                lastName: vote.user.lastName,
                profileImage: vote.user.profileImage,
                company: vote.user.company,
                designation: vote.user.designation
            }));

            return {
                option,
                optionIndex: index,
                count: optionVotes.length,
                percentage: totalVotes > 0
                    ? Math.round((optionVotes.length / totalVotes) * 100)
                    : 0,
                voters: voteDetails // Only included if poll is not anonymous
            };
        });

        return voteCounts;
    }

// Get all options that a user has voted on
    private getUserPollVotes(poll: Poll, userId: string): number[] {
        if (!poll || !poll.votes || !userId) {
            return [];
        }

        // Find all votes by this user
        const userVotes = poll.votes.filter(vote => vote.userId === userId);

        // Extract the option indices
        return userVotes.map(vote => vote.optionIndex);
    }

    async addOption(
        req: ICustomRequest,
        res: Response,
        next: NextFunction
    ): Promise<void> {
        try {
            const { pollId } = req.params;
            const { option } = req.body;
            const userId = req.user?.id;

            // Find the poll
            const poll = await this.pollRepo.findOne({
                where: { id: pollId },
                relations: ["post", "post.author"]
            });

            if (!poll) {
                throw new ApiError("Poll not found", HTTP_STATUS.NOT_FOUND);
            }

            // Check if adding options is allowed
            if (!poll.allowAddOptions) {
                throw new ApiError(
                    "Adding options to this poll is not allowed",
                    HTTP_STATUS.FORBIDDEN
                );
            }

            // Check if poll has ended
            if (poll.endDate && new Date() > poll.endDate) {
                throw new ApiError("Poll has ended", HTTP_STATUS.BAD_REQUEST);
            }

            // Check if option already exists
            if (poll.options.includes(option)) {
                throw new ApiError(
                    "This option already exists in the poll",
                    HTTP_STATUS.BAD_REQUEST
                );
            }

            // Add the new option
            poll.options = [...poll.options, option];
            await this.pollRepo.save(poll);

            // Notify poll creator if it's not the same person adding the option
            if (poll.post.author.id !== userId) {
                try {
                    await Notification.create({
                        user: poll.post.author.userChatId,
                        title: "New Poll Option Added",
                        message: `Someone added a new option to your poll: "${poll.question}"`,
                        type: "info",
                        metadata: {
                            postId: poll.post.id,
                            pollId: poll.id
                        }
                    });
                } catch (error) {
                    logger.error(`Failed to create notification: ${error.message}`);
                }
            }

            res.status(HTTP_STATUS.OK).json(
                handleResponse("Poll option added successfully", {
                    poll
                })
            );
        } catch (error) {
            logger.error(
                `PollController :: addOption :: ${(error as Error)?.message}`
            );
            return next(error);
        }
    }

    async endPoll(
        req: ICustomRequest,
        res: Response,
        next: NextFunction
    ): Promise<void> {
        try {
            const { pollId } = req.params;
            const userId = req.user?.id;

            // Find the poll
            const poll = await this.pollRepo.findOne({
                where: { id: pollId },
                relations: ["post", "post.author"]
            });

            if (!poll) {
                throw new ApiError("Poll not found", HTTP_STATUS.NOT_FOUND);
            }

            // Check if user is the creator of the poll
            if (poll.post.author.id !== userId) {
                throw new ApiError(
                    "Only the poll creator can end the poll",
                    HTTP_STATUS.FORBIDDEN
                );
            }

            // Check if poll is already ended
            if (poll.endDate && new Date() > poll.endDate) {
                throw new ApiError("Poll has already ended", HTTP_STATUS.BAD_REQUEST);
            }

            // End the poll
            poll.endDate = new Date();
            await this.pollRepo.save(poll);

            // Get results
            const results = await this.getPollResults(poll);

            res.status(HTTP_STATUS.OK).json(
                handleResponse("Poll ended successfully", {
                    poll,
                    results: poll.showResults ? results : null
                })
            );
        } catch (error) {
            logger.error(
                `PollController :: endPoll :: ${(error as Error)?.message}`
            );
            return next(error);
        }
    }

    async removeVote(
        req: ICustomRequest,
        res: Response,
        next: NextFunction
    ): Promise<void> {
        try {
            const { pollId } = req.params;
            const { optionIndex } = req.body; // Optionally allow removing vote for a specific option
            const userId = req.user?.id;

            // Find the poll
            const poll = await this.pollRepo.findOne({
                where: { id: pollId },
                relations: ["post", "post.author", "votes"]
            });

            if (!poll) {
                throw new ApiError("Poll not found", HTTP_STATUS.NOT_FOUND);
            }

            // Check if poll has ended
            if (poll.endDate && new Date() > poll.endDate) {
                throw new ApiError("Poll has ended, votes cannot be removed", HTTP_STATUS.BAD_REQUEST);
            }

            // Find the vote(s) to remove
            let votesToRemove;
            if (optionIndex !== undefined) {
                // Remove vote for a specific option
                votesToRemove = await this.pollVoteRepo.find({
                    where: { pollId, userId, optionIndex }
                });
            } else {
                // Remove all user's votes for this poll
                votesToRemove = await this.pollVoteRepo.find({
                    where: { pollId, userId }
                });
            }

            if (votesToRemove.length === 0) {
                throw new ApiError("No votes found to remove", HTTP_STATUS.NOT_FOUND);
            }

            // Delete the votes
            await Promise.all(votesToRemove.map(vote =>
                this.pollVoteRepo.delete(vote.id)
            ));

            // Reload poll with updated votes
            const updatedPoll = await this.pollRepo.findOne({
                where: { id: pollId },
                relations: ["post", "post.author", "votes"]
            });

            // Get vote counts for response
            const voteCounts = await this.getPollVoteCounts(updatedPoll);

            // Determine user's votes
            const userVotes = this.getUserPollVotes(updatedPoll, userId);
            const hasVoted = userVotes.length > 0;

            // Calculate poll statistics
            const pollStats = {
                totalVotes: updatedPoll.votes.length,
                hasEnded: updatedPoll.endDate ? new Date() > updatedPoll.endDate : false
            };

            // Remove sensitive data if poll is anonymous
            if (updatedPoll.isAnonymous) {
                delete updatedPoll.votes;
            }

            res.status(HTTP_STATUS.OK).json(
                handleResponse("Vote removed successfully", {
                    poll: updatedPoll,
                    results: updatedPoll.showResults ? voteCounts : null,
                    userVote: userVotes.length > 0 ? userVotes[userVotes.length - 1] : null,
                    userVotes: poll.allowMultipleVotes ? userVotes : undefined,
                    hasVoted: hasVoted,
                    pollStats: pollStats
                })
            );
        } catch (error) {
            logger.error(
                `PollController :: removeVote :: ${(error as Error)?.message}`
            );
            return next(error);
        }
    }
}