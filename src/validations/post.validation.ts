import Joi from "joi";
import { POST_STATUS, POST_TYPE, POST_VISIBILITY } from "../constants";
import { PollValidation } from "../validations/poll.validation";
import { COMMENT_VISIBILITY } from "../entity";

export class PostValidation {
  static CreatePost = Joi.object({
    content: Joi.object().unknown(true).optional(),

    imageOrder: Joi.alternatives()
      .try(Joi.string(), Joi.array().items(Joi.string()))
      .optional(),
    videoOrder: Joi.alternatives()
      .try(Joi.string(), Joi.array().items(Joi.string()))
      .optional(),
    status: Joi.string()
      .valid(...Object.values(POST_STATUS))
      .required(),
    visibility: Joi.string()
      .optional()
      .valid(...Object.values(POST_VISIBILITY))
      .required(),

    type: Joi.string()
      .optional()
      .valid(...Object.values(POST_TYPE))
      .required(),

    poll: Joi.when("type", {
      is: "POLL",
      then: PollValidation.PollSchema.required(),
      otherwise: Joi.forbidden(),
    }),
  }).unknown(true);

  static UpdatePost = Joi.object({
    imageOrder: Joi.array().items(Joi.string()).optional(),
    videoOrder: Joi.array().items(Joi.string()).optional(),
    content: Joi.object().unknown(true).optional(),
    imageKeys: Joi.alternatives()
      .try(Joi.string(), Joi.array().items(Joi.string()))
      .optional(),
    videoKeys: Joi.alternatives()
      .try(Joi.string(), Joi.array().items(Joi.string()))
      .optional(),
    thumbnailKeys: Joi.alternatives()
      .try(Joi.string(), Joi.array().items(Joi.string()))
      .optional(),

    status: Joi.string()
      .valid(...Object.values(POST_STATUS))
      .optional(),
    visibility: Joi.string()
      .optional()
      .valid(...Object.values(POST_VISIBILITY))
      .required(),

      commentVisibility: Joi.string()
      .optional()
      .valid(...Object.values(COMMENT_VISIBILITY))
      .required(),

    type: Joi.string()
      .optional()
      .valid(...Object.values(POST_TYPE))
      .required(),
  });
  static SchedulePost = Joi.object({
    scheduledDate: Joi.date().iso().greater("now").required().messages({
      "date.base": "Scheduled date must be a valid date",
      "date.format": "Scheduled date must be in ISO format",
      "date.greater": "Scheduled date must be in the future",
      "any.required": "Scheduled date is required",
    }),
  });
}
