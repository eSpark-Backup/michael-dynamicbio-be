import Joi from "joi";
import {
  IndustryType,
  OrganizationType,
  PageSize,
  PageType,
} from "../entity/page.entity";
import { GroupIndustryType, GroupStatus } from "../entity";
import { describe } from "node:test";

export class GroupValidation {
  static createGroup = Joi.object({
    name: Joi.string().required().min(2).max(100).messages({
      "string.empty": "Name is required",
      "string.min": "Name must be at least 2 characters",
      "string.max": "Name cannot exceed 100 characters",
    }),

    status: Joi.string()
      .valid(...Object.values(GroupStatus))
      .required()
      .messages({
        "any.required": "Group status is required",
        "any.only": "Invalid group status",
      }),

    description: Joi.string().allow(null, "").max(500).messages({
      "string.max": "Description cannot exceed 500 characters",
    }),

    address: Joi.string().required().messages({
      "string.empty": "Address is required",
    }),

    rules: Joi.string().allow(null, "").max(500).messages({
      "string.max": "Rules cannot exceed 500 characters",
    }),

    allowMemberInvites: Joi.boolean().default(true),
    requirePostApproval: Joi.boolean().default(true),

    industry: Joi.string()
      .valid(...Object.values(GroupIndustryType))
      .required()
      .messages({
        "any.required": "Industry is required",
        "any.only": "Invalid industry type",
      }),
  }).unknown(true);

  static updateGroup = Joi.object({
    name: Joi.string().min(2).max(100).messages({
      "string.min": "Name must be at least 2 characters",
      "string.max": "Name cannot exceed 100 characters",
    }),

    address: Joi.string(),

    industry: Joi.string()
      .valid(...Object.values(IndustryType))
      .messages({
        "any.only": "Invalid industry type",
      }),

    description: Joi.string().allow(null, ""),
    rules: Joi.string().allow(null, ""),
    status: Joi.string()
      .valid(...Object.values(GroupStatus))
      .messages({
        "any.only": "Invalid group status",
      }),
    allowMemberInvites: Joi.boolean(),
    requirePostApproval: Joi.boolean(),
  }).unknown(true);

  static addAdmin = Joi.object({
    userId: Joi.string().required().messages({
      "string.empty": "User ID is required",
    }),
  });
}
