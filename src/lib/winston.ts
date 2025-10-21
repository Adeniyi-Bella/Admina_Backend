// Copyright 2025 adeniyibella

// Licensed under the Apache License, Version 2.0 (the "License");

/**
 * Node modules
 */
import winston from 'winston';
import { Logtail } from '@logtail/node';
import { LogtailTransport } from '@logtail/winston';

/**
 * Custom modules
 */
import config from '@/config';

const { combine, timestamp, json, errors, align, printf, colorize } =
  winston.format;

// Define the transports array to hold different logging transports
const transports: winston.transport[] = [];

// Create a Logtail transport instance
const logtail = new Logtail(config.LOGTAIL_SOURCE_TOKEN, {
  endpoint: `https://${config.LOG_TAIL_INGESTING_HOST}`,
});

// If the application is not running in production, add a console transport
if (config.NODE_ENV === 'local') {
  transports.push(
    new winston.transports.Console({
      format: combine(
        colorize({ all: true }), // Add colors to log levels
        timestamp({ format: 'YYYY-MM-DD hh:mm:ss A' }), // Add timestamp to logs
        align(), // Align log messages
        printf(({ timestamp, level, message, ...meta }) => {
          const metaStr = Object.keys(meta).length
            ? `\n${JSON.stringify(meta)}`
            : '';
          return `${timestamp} [${level}]: ${message}${metaStr}`;
        }),
      ),
    }),
  );
} else {
  // In dev or prod
  transports.push(
    new winston.transports.Console({
      format: combine(timestamp(), json()),
    }),
  );

  if (!config.LOGTAIL_SOURCE_TOKEN || !config.LOG_TAIL_INGESTING_HOST) {
    throw new Error(
      'Logtail source token and ingesting host must be provided in the configuration',
    );
  }

  transports.push(new LogtailTransport(logtail));
}

// Create a logger instance using Winston
const logger = winston.createLogger({
  level: config.LOG_LEVEL || 'info', // Set the default logging level to 'info'
  format: combine(timestamp(), errors({ stack: true }), json()), // Use JSON format for log messages
  transports,
  silent: config.NODE_ENV === 'test', // Disable logging in test environment
});

export { logger, logtail };
