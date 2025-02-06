import { body, param, validationResult } from "express-validator";
import { ErrorHandler } from "../utils";

const validateHandler = (req: any, res: any, next: any) => {
  const errors = validationResult(req);

  const errorMessages = errors
    .array()
    .map((error: any) => error.msg)
    .join(", ");

  if (errors.isEmpty()) return next();
  else next(new ErrorHandler(errorMessages, 400));
};

const registerValidator = () => [
  body("name", "Name is required").notEmpty(),
  body("username", "Username is required").notEmpty(),
  body("bio", "Bio is required").notEmpty(),
  body("password", "Password is required").notEmpty(),
];

const loginValidator = () => [
  body("username", "Username is required").notEmpty(),
  body("password", "Password is required").notEmpty(),
];

const sendAttachmentsValidator = () => [
  body("chatId", "Chat ID is required").notEmpty(),
];

const chatIdValidator = () => [param("id", "Chat ID is required").notEmpty()];

const sendRequestValidator = () => [
  body("userId", "User ID is required").notEmpty(),
];

const acceptRequestValidator = () => [
  body("requestId", "Request ID is required").notEmpty(),
  body("accept")
    .notEmpty()
    .withMessage("Accept is required")
    .isBoolean()
    .withMessage("Accept must be a boolean"),
];

export {
  acceptRequestValidator,
  chatIdValidator,
  loginValidator,
  registerValidator,
  sendAttachmentsValidator,
  sendRequestValidator,
  validateHandler,
};
