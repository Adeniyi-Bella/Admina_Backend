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
import { IPlans } from '@/types';
import { asyncHandler } from './errorHandler';
import { DatabaseError, UnauthorizedError, UserNotFoundError } from '@/lib/api_response/error';

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

const resetPropertiesIfNewMonth = asyncHandler(
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const userId = req.userId;

    if (!userId) {
      logger.warn('No userId provided in request for resetPropertiesIfNewMonth');
      throw new UnauthorizedError('No userId provided in request');
    }

    const user = await User.findOne({ userId }).select('plan updatedAt').exec();
    if (!user) {
      logger.warn('User not found for resetPropertiesIfNewMonth', { userId });
      throw new UserNotFoundError();
    }

    const latestDocument = await Document.findOne({ userId })
      .sort({ updatedAt: -1 })
      .select('updatedAt')
      .exec();

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

    const timestamps = [
      userLastUpdated,
      documentLastUpdated,
      chatBotHistoryLastUpdated,
    ].filter((ts): ts is Date => ts !== null);
    
    const mostRecentUpdate =
      timestamps.length > 0
        ? new Date(Math.max(...timestamps.map((ts) => ts.getTime())))
        : userLastUpdated;

    const isNewMonth =
      mostRecentUpdate.getUTCFullYear() !== now.getUTCFullYear() ||
      mostRecentUpdate.getUTCMonth() !== now.getUTCMonth();

    if (isNewMonth) {
      logger.info('New Month Detected', { userId });

      const resetLengthOfDocs: { lengthOfDocs: IPlans; updatedAt: Date } = {
        lengthOfDocs: {
          premium: { max: 5, min: 0, current: 5 },
          standard: { max: 3, min: 0, current: 3 },
          free: { max: 2, min: 0, current: 2 },
        },
        updatedAt: new Date(),
      };

      const resetChatBotPrompts: { chatBotPrompt: IPlans; updatedAt: Date } = {
        chatBotPrompt: {
          premium: { max: 10, min: 0, current: 10 },
          standard: { max: 5, min: 0, current: 5 },
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
        lengthOfDocsResult.modifiedCount === 0 &&
        documentsResult.modifiedCount === 0
      ) {
        logger.warn('Failed to reset user properties', { userId });
        throw new DatabaseError('Failed to reset user properties for new month');
      }

      logger.info('User properties reset for new month', { userId });
    }

    next();
  }
);

export default resetPropertiesIfNewMonth;
