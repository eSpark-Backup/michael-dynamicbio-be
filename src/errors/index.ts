import { ERROR_MESSAGES, HTTP_STATUS } from "../constants";

export class ApiError extends Error {
  message!: string;
  statusCode!: number;
  constructor(message: string, statusCode: number) {
    super();
    this.message = message;
    this.statusCode = statusCode;
  }
}

export class AlreadyExistsError extends ApiError {
  constructor(message: string = ERROR_MESSAGES.ALREADY_EXISTS) {
    super(message, HTTP_STATUS.ALREADY_EXISTS);
  }
}

export class NotFoundError extends ApiError {
  constructor(message: string = ERROR_MESSAGES.NOT_FOUND) {
    super(message, HTTP_STATUS.NOT_FOUND);
  }
}

export class UnprocessableEntityError extends ApiError {
  constructor(message: string) {
    super(message, HTTP_STATUS.UNPROCESSABLE_ENTITY);
  }
}

export class UnAuthorizedError extends ApiError {
  constructor(message: string = ERROR_MESSAGES.UN_AUTHORIZED) {
    super(message, HTTP_STATUS.UN_AUTHORIZED);
  }
}

export class BadRequestError extends ApiError {
  constructor(message: string = ERROR_MESSAGES.BAD_REQUEST) {
    super(message, HTTP_STATUS.BAD_REQUEST);
  }
}
