/**
 * @copyright 2025 Adeniyi Bella
 * @license Apache-2.0
 */

/**
 * Models
 */
import User from '@/models/user.model';

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

@injectable()
export class UserService implements IUserService {
  private config = {
    auth: {
      clientId: config.AZURE_CLIENT_ID!,
      clientSecret: config.AZURE_CLIENT_SECRETE!,
      authority: config.AZURE_CLIENT_AUTHORITY,
    },
  };

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

  async deleteUser(userId: string): Promise<boolean> {
    try {
      const result = await User.deleteOne({ userId }).exec();

      if (result.deletedCount === 0) {
        logger.warn('User not found for deletion', { userId });
        return false;
      }

      logger.info('User deleted successfully', { userId });
      return true;
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

      const result = await User.updateOne({ userId }, update).exec();

      if (result.modifiedCount === 0) {
        logger.warn(`User not found or ${property} not updated`, { userId });
        return false;
      }

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
    logger.info('user id:', {userId:  userId });
    const user = await User.findOne({ userId }).select('-__v').exec();
    logger.info('user from db', { user: user });
    if (!user) return null;
    return {
      userId: String(user.userId),
      plan: user.plan,
      lengthOfDocs: user.lengthOfDocs,
    };
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

    // return {
    //   userId: String(newUser.userId),
    //   plan: newUser.plan,
    // };
  }
}
