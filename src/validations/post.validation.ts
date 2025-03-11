import Joi from "joi";
import { POST_STATUS } from "../constants";

export class PostValidation {
  static CreatePost = Joi.object({
    content: Joi.object({
      description: Joi.string().optional(),
      htmlContent: Joi.string().optional(),
    }).optional(),

   imageOrder: Joi.alternatives()
      .try(Joi.string(), Joi.array().items(Joi.string()))
      .optional(),
    status: Joi.string()
      .valid(...Object.values(POST_STATUS))
      .required(),
  });

  static UpdatePost = Joi.object({
  
    imageOrder: Joi.array().items(Joi.string()).optional(),
    content: Joi.object({
      description: Joi.string().optional(),
      htmlContent: Joi.string().optional(),
    }).optional(),
    location: Joi.object({
      long: Joi.number().optional(),
      lat: Joi.number().optional(),
      additional: Joi.string().optional(),
    }).optional(),
    imageKeys: Joi.alternatives()
      .try(Joi.string(), Joi.array().items(Joi.string()))
      .optional(),
    status: Joi.string()
      .valid(...Object.values(POST_STATUS))
      .optional(),
  });

}
