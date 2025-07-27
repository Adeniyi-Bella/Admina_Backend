/**
 * @copyright 2025 Adeniyi Bella
 * @license Apache-2.0
 */

/**
 * Models
 */
import User from '@/models/user';

/**
 * Interfaces
 */
import { IUserService, UserDTO } from './user.interface';

/**
 * Node modules
 */
import { injectable } from 'tsyringe';

/**
 * Custom modules
 */
import { logger } from '@/lib/winston';

/**
 * Types
 */
import type { Request } from 'express';

@injectable()
export class UserService implements IUserService {
  
  async resetPropertiesIfNewMonth(userId: string): Promise<void> {
    try {
      const user = await User.findOne({ userId }).select('-__v').exec();
      if (!user) {
        logger.warn('User not found for resetPropertiesIfNewMonth', { userId });
        throw new Error('User not found');
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
          throw new Error('Failed to reset user properties');
        }

        logger.info('User properties reset successfully for new month', {
          userId,
        });
      } else {
        logger.info('No reset needed; not a new month', { userId });
      }
    } catch (error) {
      logger.error('Error in resetPropertiesIfNewMonth', { userId, error });
      throw new Error(
        `Failed to reset properties: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  async updatelenghtOfDocs(userId: string): Promise<boolean> {
    try {
      const result = await User.updateOne(
        { userId },
        {
          $inc: { lenghtOfDocs: 1 },
          $set: { updatedAt: new Date() },
        },
      ).exec();

      if (result.modifiedCount === 0) {
        logger.warn('User not found or lenghtOfDocs not updated', { userId });
        return false;
      }

      logger.info('lenghtOfDocs incremented successfully', { userId });
      return true;
    } catch (error) {
      logger.error('Error updating lenghtOfDocs', { userId, error });
      throw new Error(
        `Failed to update lenghtOfDocs: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  async checkIfUserExist(req: Request): Promise<UserDTO | null> {
    const userId = req.userId;
    logger.info('user id:', { userId });
    const user = await User.findOne({ userId }).select('-__v').exec();
    logger.info('user from db', { user });
    if (!user) return null;
    return {
      userId: String(user.userId),
    };
  }

  async createUserFromToken(req: Request): Promise<UserDTO> {
    const userId = req.userId;
    const email = req.email;
    const username = req.username;

    const newUser = await User.create({
      userId,
      email: email,
      username: username,
    });

    return {
      userId: String(newUser.userId),
    };
  }
}
