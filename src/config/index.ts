import { config } from "dotenv";
import { NODE_ENVS } from "../constants";
config();
const getEnv = (key: string) => {
  if (!process.env[key]) throw new Error(`${key} NOT FOUND IN ENV`);
  return process.env[key];
};

export const configs = {
  NODE_ENV: process.env.NODE_ENV ?? NODE_ENVS.DEVELOPMENT,
  PORT: Number(getEnv("PORT")),

  // JWT Configs
  JWT_SECRET_KEY: <string>getEnv("JWT_SECRET"),
  JWT_QR_SECRET_KEY: <string>getEnv("JWT_QR_SECRET"),
  EXPIRES_IN: <string>getEnv("EXPIRES_IN"),
  LINK_SECRET_KEY: <string>getEnv("LINK_SECRET_KEY"),
  QR_ISSUER: <string>getEnv("QR_ISSUER"),
  FFMPEG_PATH: <string>getEnv("FFMPEG_PATH"),

  // Redis configuration for Bull
  REDIS_HOST: process.env.REDIS_HOST || 'localhost',
  REDIS_PORT: process.env.REDIS_PORT || '5579',
  REDIS_PASSWORD: process.env.REDIS_PASSWORD || 'vIoc4ETiHMQ2kYV',

  // Bull configuration
  BULL_PREFIX: process.env.BULL_PREFIX || 'bull',

  // Queue configuration
  QUEUE_CLEAN_INTERVAL: parseInt(process.env.QUEUE_CLEAN_INTERVAL || '86400000', 10), // 24 hours in ms
  QUEUE_CONCURRENCY: parseInt(process.env.QUEUE_CONCURRENCY || '5', 10),
};

export const MAILER_CONFIG = {
  host: getEnv("SMTP_HOST"),
  port: Number(getEnv("SMTP_PORT")),
  secure: Boolean(getEnv("SMTP_SECURE")),
  service: getEnv("SMTP_SERVICE"),
  pass: getEnv("SMTP_PASS"),
  from: getEnv("SMTP_FROM"),
};



export const bcryptConfig = {
  salt: Number(getEnv("SALT")),
};

export const CLOUD_CONFIG = {
  apiKey: getEnv("CLOUD_API_KEY"),
  apiSecret: getEnv("CLOUD_SECRET"),
  cloudName: getEnv("CLOUD_NAME"),
};
