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
import { IUserService } from './user.interface';
import { UserDTO } from '@/types';

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
import {
  InvalidInputError,
  AzureAuthError,
  GraphAPIError,
  DatabaseError,
  ReregistrationBlockedError,
} from '@/lib/api_response/error';
import { cacheService } from '../redis-cache/redis-cache.service';

@injectable()
export class UserService implements IUserService {
  private config = {
    auth: {
      clientId: config.AZURE_CLIENT_ID!,
      clientSecret: config.AZURE_CLIENT_SECRETE!,
      authority: config.AZURE_CLIENT_AUTHORITY,
    },
  };

  private mapUserToDTO(user: Required<UserDTO>): Required<UserDTO> {
    return {
      userId: String(user.userId),
      plan: user.plan,
      lengthOfDocs: user.lengthOfDocs,
      email: user.email,
    };
  }

  async deleteUserFromEntraId(userId: string): Promise<boolean> {
    if (!userId) {
      throw new InvalidInputError('Valid userId is required');
    }

    try {
      const cca = new ConfidentialClientApplication(this.config);

      const result = await cca.acquireTokenByClientCredential({
        scopes: ['https://graph.microsoft.com/.default'],
      });

      if (!result?.accessToken) {
        logger.error('Failed to acquire Graph token for Entra ID deletion', {
          userId,
        });
        throw new AzureAuthError('Failed to acquire Graph token');
      }

      const client = Client.init({
        authProvider: (done) => done(null, result.accessToken),
      });

      await client.api(`/users/${userId}`).delete();
      return true;
    } catch (error: any) {
      if (error.statusCode === 404) {
        logger.warn('User not found in Entra ID for deletion', { userId });
        return false;
      }

      if (error instanceof AzureAuthError) {
        throw error; 
      }
      logger.error('Failed to delete user from Entra ID', { userId, error });
      throw new GraphAPIError('Failed to delete user from Entra ID');
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

      await cacheService.delete(`user:${userId}`);
      await cacheService.invalidateTag(`tag:user:${userId}`);

      logger.info('User deleted successfully', { userId });
      return userEmail;
    } catch (error) {
      logger.error('Error deleting user', { userId, error });
      throw new DatabaseError('Failed to delete user');
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

      await cacheService.delete(`user:${userId}`);
      await cacheService.invalidateTag(`tag:user:${userId}`);

      return true;
    } catch (error) {
      logger.error(`Error updating ${property}`, { userId, property, error });
      throw new DatabaseError(`Failed to update ${property}`);
    }
  }

  async checkIfUserExist(req: Request): Promise<UserDTO | null> {
    const userId = req.userId;
    const cacheKey = `user:${userId}`;

    return cacheService.getOrFetch<UserDTO | null>(
      cacheKey,
      async () => {
        logger.info('Cache miss: fetching user from DB', { userId });

        const user = await User.findOne({ userId })
          .select('-__v')
          .lean()
          .exec();

        if (!user) return null;

        return this.mapUserToDTO(user);
      },
      3600 // 1 hour base TTL (jitter will be added automatically)
    );
  }

  async createUserFromToken(req: Request): Promise<void> {
    const userId = req.userId;
    const email = req.email;
    const username = req.username;

    try {
      await User.create({
        userId,
        email: email,
        username: username,
      });
    } catch (error) {
      logger.error('Error creating user', { userId, email, error });
      throw new DatabaseError('Failed to create user');
    }
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

    try {
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
        logger.warn(
          'User attempted to re-register in the same month as deletion',
          { email },
        );
        throw new ReregistrationBlockedError();
      }

      await DeletedUsers.deleteOne({ email }).exec();
      logger.info(
        'User removed from DeletedUsers list (eligible for re-registration)',
        { email },
      );
    } catch (error) {
      if (error instanceof ReregistrationBlockedError) {
        throw error; // Re-throw custom errors
      }
      logger.error('Error checking user eligibility', { email, error });
      throw new DatabaseError('Failed to check user eligibility');
    }
  }
}
