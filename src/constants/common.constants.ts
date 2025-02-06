export const enum NODE_ENVS {
  DEVELOPMENT = "development",
  PRODUCTION = "production",
}

export const BASE_URL = "/v1";

export enum HTTP_STATUS {
  OK = 200,
  CREATED = 200,
  BAD_REQUEST = 400,
  UN_AUTHORIZED = 401,
  ALREADY_EXISTS = 409,
  FORBIDDEN = 403,
  NOT_FOUND = 404,
  UNPROCESSABLE_ENTITY = 422,
  SERVER_ERROR = 500,
  PAYMENT_FAILED = 402,
  INTERNAL_SERVER_ERROR = 500,
}

export const enum ERROR_MESSAGES {
  SUCCESS = "Success",
  FAILED = "Failed",
  SOMETHING_WRONG = "Something went wrong",
  ALREADY_EXISTS = "Already exists",
  NOT_FOUND = "Not found",
  UN_AUTHORIZED = "Unauthorized user",
  FORBIDDEN = "Forbidden user",
  BAD_REQUEST = "Bad request",
  PAYMENT_FAILED = "Payment failed",
}

export enum PAGINATION {
  PAGE = 1,
  PAGE_SIZE = 15,
}

export enum EntityTypes {
  STORY = "story",
  COMMENT = "comment",
  LIKE = "like",
  TESTIMONIAL_RESPONSE = "testimonial-response",
  POSTS = "posts",
  VIDEOS = "videos",
}

export const EXPIRED = "expired";

export enum RESPONSE_TYPES {
  REPORT = "report",
  RESPONSE = "response",
}

export const CHAT_COOKIE = "chat_token";
export const ONE_MINUTE_MILLISECONDS = 1000 * 60;
