import Joi from "joi";
import { POLL_RESULT_VISIBILITY } from "../entity/post.entity";

export class PollValidation {
    static PollSchema = Joi.object({
        question: Joi.string().min(3).max(200).required(),
        options: Joi.array().items(Joi.string().min(1).max(100)).min(2).max(10).required(),
        endDate: Joi.date().iso().greater('now').allow(null),
        allowMultipleVotes: Joi.boolean().default(false),
        showResults: Joi.boolean().default(true),
        isAnonymous: Joi.boolean().default(false),
        allowAddOptions: Joi.boolean().default(false),
    });

    static CreatePollPost = Joi.object({
        poll: PollValidation.PollSchema.required(),
    });

    static Vote = Joi.object({
        optionIndex: Joi.number().integer().min(0).required(),
    });

    static AddOption = Joi.object({
        option: Joi.string().min(1).max(100).required(),
    });

    // In poll.validation.ts
    static RemoveVote = Joi.object({
        optionIndex: Joi.number().integer().min(0).optional()
    });
}