import winston from 'winston';
import path from 'path';
import fs from 'fs';

// Ensure the logs directory exists
const logDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir);
}

const logFormat = winston.format.printf(({ timestamp, level, message }) => {
  return `${timestamp} [${level.toUpperCase()}]: ${message}`;
});

export const schedulerLogger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    logFormat,
  ),
  transports: [
    // 1. Write all logs to the console with colors
    new winston.transports.Console({
      format: winston.format.combine(winston.format.colorize(), logFormat),
    }),
    // 2. Write all logs to scheduler.log file
    new winston.transports.File({
      filename: path.join(logDir, 'scheduler.log'),
      level: 'info',
      maxsize: 5242880, // 5MB before rotating
      maxFiles: 5,
    }),
  ],
});
