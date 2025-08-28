import Joi from "joi";
import { LoginType } from "../entity";

export class UserValidation {
  static countryCodeValidation = Joi.string().when("phone", {
    is: Joi.exist(),
    then: Joi.string().required(),
  });
  static updateUser = Joi.object({
    firstName: Joi.string()?.optional(),
    lastName: Joi.string()?.optional(),
    profileImage: Joi.string()?.optional(),
    loginType: Joi.string()
      .valid(...Object.values(LoginType))
      .optional(),
    isSocialLogin: Joi.boolean().optional(),
    profile: Joi.boolean().optional(),
    sendEmails: Joi.boolean().optional(),
    email: Joi.string().email().optional(),
    socialId: Joi.string().optional(),
  });

  static verifyQr= Joi.object({
    token: Joi.string().required(),
  });

  static verifyResyncQr= Joi.object({
    firstToken: Joi.string().required(),
    secondToken: Joi.string().required(),
  });

  static addToFavorites = Joi.object({
    entityId: Joi.string().required(),
    entityType: Joi.string().required(),
  });

  static verifyOtp = Joi.object({
    email: Joi.string().email(),
    phone: Joi.string(),
    countryCode: Joi.string(),
    otp: Joi.string().length(4).required(),
  }).xor("email", "phone");

  static resendOtp = Joi.object({
    email: Joi.string().email(),
    phone: Joi.string(),
    countryCode: Joi.string(),
  }).xor("email", "phone");

  static passwordReset = Joi.object({
    password: Joi.string().min(8),
    token: Joi.string().required(),
  });

  static updateEmail = Joi.object({
    newEmail: Joi.string().email().required(),
    oldEmail: Joi.string().email().required(),
  });

  static changePasswordValidation = Joi.object({
    oldPassword: Joi.string().min(6).required().messages({
      "string.min": "Old password must be at least 6 characters long.",
      "any.required": "Old password is required.",
    }),
    newPassword: Joi.string().min(6).required().messages({
      "string.min": "New password must be at least 6 characters long.",
      "any.required": "New password is required.",
    }),
  });
}
