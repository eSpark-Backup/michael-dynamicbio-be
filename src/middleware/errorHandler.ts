import { ErrorRequestHandler } from "express";
import { ERROR_MESSAGES, HTTP_STATUS } from "../constants";

export const errorHandler: ErrorRequestHandler = (err, req, res, next) => {
  if (res.headersSent) {
    return next(err);
  }
  // Respond with a JSON error message
  res.status(err?.statusCode ?? HTTP_STATUS.SERVER_ERROR).json({
    status: false,
    data: null,
    message: err?.message ?? ERROR_MESSAGES.SOMETHING_WRONG,
    statusCode: err?.statusCode ?? HTTP_STATUS.SERVER_ERROR,
  });
};
