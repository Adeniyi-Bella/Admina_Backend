// Copyright 2025 adeniyibella
//
// Licensed under the Apache License, Version 2.0 (the "License");

/**
 * Node modules
 */
import 'reflect-metadata';
import './di/container';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import compression from 'compression';
import helmet from 'helmet';

/**
 * Custom modules
 */
import config from '@/config';
import limiter from '@/lib/express_rate_limit';
import { connectToDatabase, disconnectFromDatabase } from '@/lib/mongoose';
import { logger, logtail } from '@/lib/winston';

/**
 * Routers
 */
import v1Routes from '@/routes/v1';

/**
 * Middlewares
 */
import { botGuard } from '@/lib/bot_detector';
import {
  errorHandler,
  handleUnhandledRejection,
  handleUncaughtException,
} from '@/middlewares/errorHandler';

/**
 * Types
 */
import type { CorsOptions } from 'cors';

const app = express();

/* -------------------------------------------------------------------------- */
/*                         Process-level fatal handlers                        */
/* -------------------------------------------------------------------------- */
handleUncaughtException();
handleUnhandledRejection();

/* -------------------------------------------------------------------------- */
/*                               CORS configuration                            */
/* -------------------------------------------------------------------------- */
const corsOptions: CorsOptions = {
  origin(origin, callback) {
    logger.info('Origin is:', { origin });

    if (!origin || config.WHITELIST_ORIGINS.includes(origin)) {
      callback(null, true);
    } else {
      logger.warn(`CORS error: ${origin} is not allowed by CORS`);
      callback(new Error(`CORS error: ${origin} is not allowed by CORS`), false);
    }
  },
};

app.use(cors(corsOptions));

/* -------------------------------------------------------------------------- */
/*                              Global middleware                              */
/* -------------------------------------------------------------------------- */
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.use(
  compression({
    threshold: 1024,
  }),
);

app.use(helmet());
app.use(limiter);
app.use(botGuard);

/* -------------------------------------------------------------------------- */
/*                             Application bootstrap                           */
/* -------------------------------------------------------------------------- */
(async () => {
  try {
    await connectToDatabase('Server');

    // Routes
    app.use('/api/v1', v1Routes);

    app.use((_, res) => {
      res.status(404).json({
        status: 'error',
        code: 'NOT_FOUND',
        message: 'Route not found',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
      });
    });

    // Global Express error handler middleware
    app.use(errorHandler);

    app.listen(config.PORT, () => {
      logger.info(`Server running: http://localhost:${config.PORT}`);
    });
  } catch (err) {
    logger.error('Failed to start the server', err);
    process.exit(1);
  }
})();

/* -------------------------------------------------------------------------- */
/*                           Graceful shutdown logic                            */
/* -------------------------------------------------------------------------- */
const handleServerShutdown = async () => {
  try {
    logger.warn('Server SHUTDOWN initiated');

    await disconnectFromDatabase('Server');
    await logtail.flush();

    process.exit(0);
  } catch (err) {
    logger.error('Error during server shutdown', err);
    process.exit(1);
  }
};

process.on('SIGTERM', handleServerShutdown);
process.on('SIGINT', handleServerShutdown);
