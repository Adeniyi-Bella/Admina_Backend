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
