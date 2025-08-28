import { Request, Response, NextFunction } from "express";
import jwt, { JwtPayload } from "jsonwebtoken";
import { ICustomRequest } from "../interfaces/index";
import { logger } from "../utils";
import { UnAuthorizedError } from "../errors";

export const optionalCheckJwt = (
  req: ICustomRequest,
  res: Response,
  next: NextFunction
) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return next(); 

  try {
    const secret = process.env.JWT_SECRET!;

    const decoded = jwt.verify(token, secret) as JwtPayload;

    req.user = {
      id: decoded.id,
      email: decoded.email,
      role: decoded.role,
      _id: decoded._id,
    };

    return next();
  } catch (error) {
    logger.error(`Error in checkJwt middleware: ${(error as Error)?.message}`);
    return next(new UnAuthorizedError());
  }
};
