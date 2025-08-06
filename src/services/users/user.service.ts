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

  async updateUser(userId: string, property: string, increment: boolean, value: string | undefined ): Promise<boolean> {
    try {
      const update = increment
        ? { $inc: { [property]: 1 }, $set: { updatedAt: new Date() } }
        : { $set: { [property]: value, updatedAt: new Date() } };

      const result = await User.updateOne(
        { userId },
        update,
      ).exec();

      if (result.modifiedCount === 0) {
        logger.warn(`User not found or ${property} not updated`, { userId });
        return false;
      }

      logger.info(`${property} ${increment ? 'incremented' : 'updated'} successfully`, { userId, property, value: increment ? 1 : value });
      return true;
    } catch (error) {
      logger.error(`Error updating ${property}`, { userId, property, error });
      throw new Error(
        `Failed to update ${property}: ${error instanceof Error ? error.message : 'Unknown error'}`,
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
      plan: user.plan,
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
      plan: newUser.plan,
    };
  }
}
