import { Request, Response, NextFunction } from "express";
import jwt, { JwtPayload } from "jsonwebtoken";
import { ICustomRequest } from "../interfaces/index";
import { logger } from "../utils";
import { UnAuthorizedError } from "../errors";

export const QrCheckJwt = (
  req: ICustomRequest,
  res: Response,
  next: NextFunction
) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) throw new Error("Token not found");

  try {
    const secret = process.env.JWT_QR_SECRET!;

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


