/**
 * @copyright 2025 Adeniyi Bella
 * @license Apache-2.0
 */

/**
 * Custom modules
 */
import { logger } from '@/lib/winston';

/**
 * Types
 */
import type { Request, Response, NextFunction } from 'express';
import { AppError, InternalServerError } from '@/lib/api_response/error';

/**
 * Global error handler middleware
 * This should be the last middleware in your Express app
 */
export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
): Response<any, Record<string, any>> | void => {
  // If headers already sent, delegate to default Express error handler
  if (res.headersSent) {
    return next(err);
  }

  // Handle AppError instances (our custom errors)
  if (err instanceof AppError) {
    logger.error('Application error', {
      code: err.code,
      message: err.message,
      statusCode: err.statusCode,
      path: req.path,
      method: req.method,
      userId: req.userId,
      stack: err.stack,
      isOperational: err.isOperational,
    });

    // Return structured error response
    return res.status(err.statusCode).json({
      status: 'error',
      code: err.code,
      message: err.message,
      timestamp: new Date().toISOString(),
      version: '1.0.0',
    });
  }

  // Handle unexpected errors (non-AppError)
  logger.error('Unexpected error', {
    message: err.message,
    name: err.name,
    path: req.path,
    method: req.method,
    userId: req.userId,
    stack: err.stack,
  });

  // Don't expose internal error details in production
  const message = process.env.NODE_ENV === 'production' 
    ? 'An unexpected error occurred' 
    : err.message;

  // Create an InternalServerError and send a proper HTTP response
  const internalError = new InternalServerError(message);
  return res.status(internalError.statusCode).json({
    status: 'error',
    code: internalError.code,
    message: internalError.message,
    timestamp: new Date().toISOString(),
    version: '1.0.0',
  });
};

/**
 * Async handler wrapper
 * Wraps async route handlers to catch errors and pass them to error middleware
 */
export const asyncHandler = (
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>
) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * Handle unhandled promise rejections
 */
export const handleUnhandledRejection = () => {
  process.on('unhandledRejection', (reason: Error, promise: Promise<any>) => {
    logger.error('Unhandled Promise Rejection', {
      reason: reason.message,
      stack: reason.stack,
      promise,
    });
    
    // In production, you might want to gracefully shutdown
    if (process.env.NODE_ENV === 'production') {
      // Implement graceful shutdown logic here
      logger.error('Shutting down due to unhandled rejection');
      process.exit(1);
    }
  });
};

/**
 * Handle uncaught exceptions
 */
export const handleUncaughtException = () => {
  process.on('uncaughtException', (error: Error) => {
    logger.error('Uncaught Exception', {
      message: error.message,
      stack: error.stack,
    });
    
    // Always exit on uncaught exception
    logger.error('Shutting down due to uncaught exception');
    process.exit(1);
  });
};