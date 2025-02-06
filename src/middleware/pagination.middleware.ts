import { RequestHandler } from "express";
import { IQueryObject } from "../interfaces";
import { PAGINATION } from "../constants";

export const setPagination: RequestHandler = async (req, res, next) => {
  const pagination = req.query as IQueryObject;

  const pageSize = +(pagination.pageSize || PAGINATION.PAGE_SIZE);
  const page = Math.max(1, +(pagination.page || PAGINATION.PAGE));

  const take = Number(pageSize) || 10;
  const skip = Number(page) ? (Number(page) - 1) * take : 0;
  req.query = {
    ...req.query,
    pageSize: pageSize.toString(),
    page: page.toString(),
    take: take.toString(),
    skip: skip.toString(),
  } as Record<string, string>;

  return next();
};
