import { NextFunction, Request, Response } from "express";
import Joi, { Schema } from "joi";
import { ApiError, UnprocessableEntityError } from "../errors";

export const validate =
  (schema: Schema, value: "body" | "query" = "body") =>
  (req: Request, res: Response, next: NextFunction) => {
    try {
      const { error } = schema.validate(req[value]);
      if (error) {
        throw new UnprocessableEntityError(
          error.details[0].message.replace(new RegExp(/\"/, "g"), "")
        );
      }
      return next();
    } catch (err) {
      console.log((err as Error)?.message);
      return next(err);
    }
  };

export const objectIdValidation = Joi.string().hex().length(24);
