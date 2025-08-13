/**
 * @copyright 2025 Adeniyi Bella
 * @license Apache-2.0
 */

/**
 * Models
 */
import User from '@/models/user.model';
import Document from '@/models/document.model';
import ChatBotHistory from '@/models/chatbotHistory.model';

/**
 * Custom modules
 */
import { logger } from '@/lib/winston';

/**
 * Types
 */
import type { Request, Response, NextFunction } from 'express';
import { ApiResponse } from '@/lib/api_response';

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
 * Middleware to reset user properties ( doc prompts and lengthOfDocs) if it's a new month.
 */
const resetPropertiesIfNewMonth = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  const userId = req.userId;

  if (!userId) {
    logger.warn('No userId provided in request for resetPropertiesIfNewMonth');
    ApiResponse.badRequest(
      res,
      'No userId provided in request for resetPropertiesIfNewMonth.',
    );

    return;
  }

  try {
    // Retrieve user
    const user = await User.findOne({ userId }).select('plan updatedAt').exec();
    if (!user) {
      logger.warn('User not found for resetPropertiesIfNewMonth', { userId });
      ApiResponse.notFound(res, 'User not found');
      return;
    }

    // Find the most recent document for the user
    const latestDocument = await Document.findOne({ userId })
      .sort({ updatedAt: -1 })
      .select('updatedAt')
      .exec();

    // Find the most recent chatbot history for the user
    const latestChatBotHistory = await ChatBotHistory.findOne({ userId })
      .sort({ updatedAt: -1 })
      .select('updatedAt')
      .exec();

    const now = new Date();
    const userLastUpdated = new Date(user.updatedAt);
    const documentLastUpdated = latestDocument
      ? new Date(latestDocument.updatedAt!)
      : null;
    const chatBotHistoryLastUpdated = latestChatBotHistory
      ? new Date(latestChatBotHistory.updatedAt)
      : null;

    // Find the most recent update timestamp
    const timestamps = [
      userLastUpdated,
      documentLastUpdated,
      chatBotHistoryLastUpdated,
    ].filter((ts): ts is Date => ts !== null);
    const mostRecentUpdate =
      timestamps.length > 0
        ? new Date(Math.max(...timestamps.map((ts) => ts.getTime())))
        : userLastUpdated;

    // Check if it's a new month based on the most recent update
    const isNewMonth =
      mostRecentUpdate.getUTCFullYear() !== now.getUTCFullYear() ||
      mostRecentUpdate.getUTCMonth() !== now.getUTCMonth();

    if (isNewMonth) {
      // Set reset values based on user plan
      const resetLengthOfDocs = {
        lengthOfDocs: {
          premium: { max: 5, min: 0, current: 5 },
          free: { max: 2, min: 0, current: 2 },
        },
        updatedAt: new Date(),
      };

      const resetChatBotPrompts = {
        chatBotPrompt: {
          premium: { max: 10, min: 0, current: 10 },
          free: { max: 0, min: 0, current: 0 },
        },
        updatedAt: new Date(),
      };

      const lengthOfDocsResult = await User.updateOne(
        { userId },
        { $set: resetLengthOfDocs },
      ).exec();

      const documentsResult = await Document.updateMany(
        { userId },
        { $set: resetChatBotPrompts },
      ).exec();

      if (
        lengthOfDocsResult.modifiedCount === 0 ||
        documentsResult.modifiedCount === 0
      ) {
        logger.warn('Failed to reset user properties', { userId });
        ApiResponse.serverError(res, 'Failed to reset user properties');
        return;
      }
    } else {
      logger.info('No reset needed; not a new month', {
        userId,
        plan: user.plan,
      });
    }

    next();
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    ApiResponse.serverError(res, 'Error in reset PRoperties new month', errorMessage);
    logger.error('Error in reset PRoperties new month', errorMessage);
  }
};

export default resetPropertiesIfNewMonth;
