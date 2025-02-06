import { NextFunction, Request, Response } from "express";
import { ROLES } from "../constants";
import { logger } from "../utils";
import { ICustomRequest } from "../interfaces";
import { UnAuthorizedError } from "../errors";

export const validateRoles =
  (roles: ROLES[]) =>
  async (req: ICustomRequest, _res: Response, next: NextFunction) => {
    try {
      const userDetails = req?.user;

      if (!roles.includes(userDetails?.role as ROLES)) {
        throw new UnAuthorizedError(
          "You are not authorized to access this route"
        );
      }
      return next();
    } catch (err) {
      logger.error(`Error in validateRoles :: ${(err as Error).message}`);
      next(err);
    }
  };
