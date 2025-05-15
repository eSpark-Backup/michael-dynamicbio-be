import { envMode } from "../app";

const errorMiddleware = (err: any, req: any, res: any, next: any) => {
  err.message ||= "Internal Server Error";
  err.statusCode ||= 500;

  // Duplicate key
  if (err.code === 11000) {
    const error = Object.keys(err.keyPattern).join(", ");
    err.message = `${error} already exists`;
    err.statusCode = 400;
  }

  if (err.name === "CastError") {
    err.message = `Resource not found. Invalid: ${err.path}`;
    err.statusCode = 400;
  }

  const response = {
    success: false,
    message: err.message,
  };

  return res.status(err.statusCode).json(response);
};

const TryCatch = (passedFunc: any) => async (req: any, res: any, next: any) => {
  try {
    await passedFunc(req, res, next);
  } catch (error) {
    next(error);
  }
};

export { errorMiddleware, TryCatch };
