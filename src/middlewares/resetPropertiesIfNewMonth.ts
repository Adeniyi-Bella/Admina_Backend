/**
 * @copyright 2025 Adeniyi Bella
 * @license Apache-2.0
 */

/**
 * Models
 */
import User from '@/models/user';

/**
 * Custom modules
 */
import { logger } from '@/lib/winston';

/**
 * Types
 */
import type { Request, Response, NextFunction } from 'express';

/**
 * Middleware to reset user properties (prompt and lenghtOfDocs) if it's a new month.
 */
const resetPropertiesIfNewMonth = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  const userId = req.userId;

  if (!userId) {
    logger.warn('No userId provided in request for resetPropertiesIfNewMonth');
    res.status(400).json({
      code: 'Bad Request',
      error: 'User ID is required.',
    });
    return;
  }

  try {
    const user = await User.findOne({ userId }).select('-__v').exec();
    if (!user) {
      logger.warn('User not found for resetPropertiesIfNewMonth', { userId });
      res.status(400).json({
        code: 'Bad Request',
        error: 'User not found.',
      });
      return;
    }

    const lastUpdated = new Date(user.updatedAt);
    const now = new Date();

    const isNewMonth =
      lastUpdated.getUTCFullYear() !== now.getUTCFullYear() ||
      lastUpdated.getUTCMonth() !== now.getUTCMonth();

    if (isNewMonth) {
      const result = await User.updateOne(
        { userId },
        {
          $set: {
            prompt: 5,
            lenghtOfDocs: 0,
            updatedAt: new Date(),
          },
        },
      ).exec();

      if (result.modifiedCount === 0) {
        logger.warn('Failed to reset user properties', { userId });
        res.status(500).json({
          code: 'Internal Server Error',
          error: 'Failed to reset user properties.',
        });
        return;
      }

      logger.info('User properties reset successfully for new month', {
        userId,
      });
    } else {
      logger.info('No reset needed; not a new month', { userId });
    }

    next();
  } catch (error) {
    logger.error('Error in resetPropertiesIfNewMonth middleware', {
      userId,
      error:
        error instanceof Error
          ? { message: error.message, stack: error.stack }
          : 'Unknown error',
    });
    res.status(500).json({
      code: 'Internal Server Error',
      error: 'Failed to reset user properties.',
    });
  }
};

export default resetPropertiesIfNewMonth;
