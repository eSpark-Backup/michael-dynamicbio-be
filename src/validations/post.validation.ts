import Joi from "joi";
import { POST_STATUS, POST_TYPE, POST_VISIBILITY } from "../constants";

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
  });

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

    type: Joi.string()
      .optional()
      .valid(...Object.values(POST_TYPE))
      .required(),
  });
}
