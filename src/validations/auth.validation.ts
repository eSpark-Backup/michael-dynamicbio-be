import Joi from "joi";
import { LoginType } from "../entity";
import { profile } from "console";

export class AuthValidation {
  static countryCodeValidation = Joi.string().when("phone", {
    is: Joi.exist(),
    then: Joi.string().required(),
  });
  static signupUser = Joi.object({
    firstName: Joi.string()?.optional(),
    email: Joi.string().email(),
    countryCode: Joi.string().optional(),
    lastName: Joi.string()?.optional(),
    phoneNumber: Joi.string()?.optional(),
    loginType: Joi.string().valid(...Object.values(LoginType)),
    isSocialLogin: Joi.boolean().optional(),
    socialId: Joi.string().optional(),
    password: Joi.string().min(8).optional(),
    role: Joi.string().required(),
    about:Joi.object().unknown(true).optional(),
  });

  static loginUser = Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().min(8).required(),
  });

  static deleteAccountValidation = Joi.object({
    email: Joi.string().email().required(),
  });

  static LoginValidations = Joi.object({
    email: Joi.string().email(),
    password: Joi.string().min(8),
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

  static forgotPassword = Joi.object({
    email: Joi.string().email().required(),
  });
  static findEmail = Joi.object({
    email: Joi.string().email().required(),
  });

  static passwordReset = Joi.object({
    newPassword: Joi.string().min(8),
  });
}
