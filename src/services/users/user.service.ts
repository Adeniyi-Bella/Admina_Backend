/**
 * @copyright 2025 Adeniyi Bella
 * @license Apache-2.0
 */

/**
 * Models
 */
import User from '@/models/user.model';
import DeletedUsers from '@/models/deletedUsers.model';

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
import config from '@/config';
import { ConfidentialClientApplication } from '@azure/msal-node';
import { Client } from '@microsoft/microsoft-graph-client';
import redis from '@/lib/redis';

@injectable()
export class UserService implements IUserService {
  private config = {
    auth: {
      clientId: config.AZURE_CLIENT_ID!,
      clientSecret: config.AZURE_CLIENT_SECRETE!,
      authority: config.AZURE_CLIENT_AUTHORITY,
    },
  };

  private getCacheKey(userId: string): string {
    return `user:${userId}`;
  }

  private mapUserToDTO(user: Required<UserDTO>): Required<UserDTO> {
    return {
      userId: String(user.userId),
      plan: user.plan,
      lengthOfDocs: user.lengthOfDocs,
      email: user.email,
    };
  }

  async deleteUserFromEntraId(userId: string): Promise<boolean> {
    try {
      if (!userId) {
        throw new Error('Valid userId is required');
      }

      const cca = new ConfidentialClientApplication(this.config);

      const result = await cca.acquireTokenByClientCredential({
        scopes: ['https://graph.microsoft.com/.default'],
      });

      if (!result?.accessToken) {
        logger.error('Failed to acquire Graph token for Entra ID deletion', {
          userId,
        });
        throw new Error('Failed to acquire Graph token');
      }

      const client = Client.init({
        authProvider: (done) => done(null, result.accessToken),
      });

      await client.api(`/users/${userId}`).delete();
      logger.info('User deleted successfully from Entra ID', { userId });
      return true;
    } catch (error: any) {
      if (error.statusCode === 404) {
        logger.warn('User not found in Entra ID for deletion', { userId });
        return false;
      }
      logger.error('Failed to delete user from Entra ID', { userId, error });
      throw new Error(`Failed to delete user from Entra ID`);
    }
  }

  async deleteUser(userId: string): Promise<string | null> {
    try {
      const user = await User.findOne({ userId });

       if (!user) {
        logger.warn('User not found for deletion', { userId });
        return null;
      }

      const userEmail = user.email;

      const result = await User.deleteOne({ userId }).exec();

      if (result.deletedCount === 0) {
        logger.warn('User not found for deletion', { userId });
        return null;
      }

      await redis.del(this.getCacheKey(userId));

      logger.info('User deleted successfully', { userId });
      return userEmail;
    } catch (error) {
      logger.error('Error deleting user', { userId, error });
      throw new Error(
        `Failed to delete user: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  async updateUser(
    userId: string,
    property: string,
    decrement: boolean,
    value: string | undefined | number | {},
  ): Promise<boolean> {
    try {
      const update = decrement
        ? { $inc: { [property]: -1 }, $set: { updatedAt: new Date() } }
        : { $set: { [property]: value, updatedAt: new Date() } };

      const updatedUser = await User.findOneAndUpdate({ userId }, update, {
        new: true,
        projection: { __v: 0 },
      }).exec();

      if (!updatedUser) {
        logger.warn(`User not found or ${property} not updated`, { userId });
        return false;
      }

      const userDTO = this.mapUserToDTO(updatedUser);
      const cacheKey = this.getCacheKey(userId);
      await redis.set(cacheKey, JSON.stringify(userDTO), 'EX', 3600);

      logger.info(
        `${property} ${decrement ? 'decremented' : 'updated'} successfully`,
        { userId, property, value: decrement ? 1 : value },
      );
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
    const cacheKey = this.getCacheKey(userId);

    try {
      const cachedData = await redis.get(cacheKey);
      if (cachedData) {
        logger.info('Serving user from Redis Cache', { userId });
        return JSON.parse(cachedData) as UserDTO;
      }
    } catch (err) {
      logger.error('Redis get error', { error: err });
    }

    logger.info('User not in cache, fetching from DB', { userId });

    const user = await User.findOne({ userId }).select('-__v').exec();

    if (!user) return null;

    const userDTO = this.mapUserToDTO(user);

    logger.info('user from db', {
      user: {
        id: user.userId,
        email: user.email,
      },
    });
    redis.set(cacheKey, JSON.stringify(userDTO), 'EX', 3600).catch((err) => {
      logger.error('Failed to set cache', { error: err });
    });

    return userDTO;
  }

  async createUserFromToken(req: Request): Promise<void> {
    const userId = req.userId;
    const email = req.email;
    const username = req.username;

    await User.create({
      userId,
      email: email,
      username: username,
    });
  }

  async archiveUser(email: string): Promise<void> {
    try {
      await DeletedUsers.create({
        email: email,
        deletedAt: new Date(),
      });
      logger.info('User archived to DeletedUsers collection', { email });
    } catch (error) {
      // Log error but don't break the flow since the user is already deleted
      logger.error('Failed to archive user', { email, error });
    }
  }

  async checkUserEligibility(req: Request): Promise<void> {
    const email = req.email;
    const deletedUser = await DeletedUsers.findOne({ email });

    if (!deletedUser) {
      return;
    }

    const now = new Date();
    const deletedAt = deletedUser.deletedAt;

    const isSameMonth =
      now.getMonth() === deletedAt.getMonth() &&
      now.getFullYear() === deletedAt.getFullYear();

    if (isSameMonth) {
      await this.deleteUserFromEntraId(req.userId);
      logger.warn('User attempted to re-register in the same month as deletion', { email });
      throw new Error('You cannot re-register in the same month you deleted your account.');
    }
    await DeletedUsers.deleteOne({ email }).exec();
    logger.info('User removed from DeletedUsers list (eligible for re-registration)', { email });
  }

}
