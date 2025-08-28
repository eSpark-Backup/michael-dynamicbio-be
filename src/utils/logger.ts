/* eslint-disable no-mixed-spaces-and-tabs */
import { createLogger, transports, format, addColors } from 'winston';
import { NODE_ENVS } from '../constants';

const { combine, timestamp, json, colorize } = format;

const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
};
addColors(colors);

export const logger = createLogger({
  transports: [new transports.Console(), new transports.File({ filename: 'logs/info.log', level: 'info' })],
  format: combine(
    timestamp({
      format: 'YYYY-MM-DD HH:mm:ss',
    }),
    json(),
    colorize({ all: true }),
  ),
});
