/**
 * @copyright 2025 Adeniyi Bella
 * @license Apache-2.0
 */

/**
 * Models
 */
import User from '@/models/user';
import Document from '@/models/document';

/**
 * Custom modules
 */
import { logger } from '@/lib/winston';

/**
 * Types
 */
import type { Request, Response, NextFunction } from 'express';

/**
 * Helper function to format a date as DD/MM/YYYY: HH:MM in UTC
 */
const formatDate = (date: Date | null): string => {
  if (!date) return 'none';
  const day = String(date.getUTCDate()).padStart(2, '0');
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const year = date.getUTCFullYear();
  const hours = String(date.getUTCHours()).padStart(2, '0');
  const minutes = String(date.getUTCMinutes()).padStart(2, '0');
  return `${day}/${month}/${year}: ${hours}:${minutes}`;
};

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

    // Find the most recent document for the user
    const latestDocument = await Document.findOne({ userId })
      .sort({ updatedAt: -1 })
      .select('updatedAt')
      .exec();

    const now = new Date();
    const userLastUpdated = new Date(user.updatedAt);
    const documentLastUpdated = latestDocument
      ? new Date(latestDocument.updatedAt)
      : null;

    // Check if it's a new month based on the most recent update (user or document)
    const isNewMonth = 
      (userLastUpdated.getUTCFullYear() !== now.getUTCFullYear() ||
       userLastUpdated.getUTCMonth() !== now.getUTCMonth()) ||
      (documentLastUpdated &&
        (documentLastUpdated.getUTCFullYear() !== now.getUTCFullYear() ||
         documentLastUpdated.getUTCMonth() !== now.getUTCMonth()));

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
        currentDate: formatDate(now),
        userLastUpdated: formatDate(userLastUpdated),
        documentLastUpdated: formatDate(documentLastUpdated),
      });
    } else {
      logger.info('No reset needed; not a new month', {
        currentDate: formatDate(now),
        userLastUpdated: formatDate(userLastUpdated),
        documentLastUpdated: formatDate(documentLastUpdated),
      });
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
