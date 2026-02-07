/**
 * @copyright 2025 Adeniyi Bella
 * @license Apache-2.0
 */

/**
 * Models
 */
import User, { PlanLimits, PlanType } from '@/models/user.model';

/**
 * Interfaces
 */
import { IUserService } from './user.interface';
import { QuotaResetUser, UserDTO } from '@/types';

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
import {
  InvalidInputError,
  DatabaseError,
  ReregistrationBlockedError,
  ErrorSerializer,
  UserNotFoundError,
} from '@/lib/api_response/error';
import { cacheService } from '../redis-cache/redis-cache.service';
import mongoose from 'mongoose';
import { getPlanMetadata } from '@/utils/user.utils';
import Document, { ChatbotPlanLimits } from '@/models/document.model';

@injectable()
export class UserService implements IUserService {
  private config = {
    auth: {
      clientId: config.AZURE_CLIENT_ID!,
      clientSecret: config.AZURE_CLIENT_SECRETE!,
      authority: config.AZURE_CLIENT_AUTHORITY,
    },
  };

  private getStartOfNextMonth(): Date {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth() + 1, 1);
  }

  private getUserTag(userId: string): string {
    return `tag:user:${userId}`;
  }

  public async deleteUserFromEntraId(userId: string): Promise<boolean> {
    try {
      if (!userId) {
        throw new InvalidInputError('Valid userId is required');
      }
      const cca = new ConfidentialClientApplication(this.config);

      const result = await cca.acquireTokenByClientCredential({
        scopes: ['https://graph.microsoft.com/.default'],
      });

      if (!result?.accessToken) {
        logger.warn('Failed to acquire Graph token for Entra ID deletion', {
          userId,
        });
        return false;
      }

      const client = Client.init({
        authProvider: (done) => done(null, result.accessToken),
      });

      const permanentDeleteDate = new Date();
      permanentDeleteDate.setDate(permanentDeleteDate.getDate() + 30);

      const deletePayload = {
        accountEnabled: false, // Blocks login and reservations
        onPremisesExtensionAttributes: {
          extensionAttribute1: permanentDeleteDate.toISOString(),
        },
      };
      await client.api(`/users/${userId}`).patch(deletePayload);
      return true;
    } catch (error: any) {
      const status =
        error?.statusCode ?? error?.response?.status ?? error?.status ?? 500;

      switch (status) {
        case 404:
          logger.warn('User not found in Entra ID (already deleted)', {
            userId,
            status,
            error,
          });
          return true;
        case 400:
          logger.warn('Valid userId is required or a microsoft problem)', {
            userId,
            status,
            error,
          });
          return true;

        case 401:
        case 403:
          logger.warn('Unauthorized to delete user from Entra ID', {
            userId,
            status,
            error,
          });
          return true;

        default:
          logger.warn('Failed to delete user from Entra ID', {
            userId,
            status,
            error,
          });
          return false;
      }
    }
  }

  public async deleteUser(userId: string): Promise<void> {
    // const nextMonthDate = this.getStartOfNextMonth();

    try {
      const result = await User.updateOne(
        { userId: userId },
        {
          $set: {
            status: 'disabled',
            deletedAt: new Date(),
            // permanentDeleteAt: nextMonthDate,
          },
        },
      ).exec();

      if (result.matchedCount === 0) {
        logger.warn('Attempted to delete non-existent user', { userId });
      } else {
        await cacheService.invalidateTag(this.getUserTag(userId));
        logger.info('User status successfully changed to disabled', {
          userId,
          // permanentDeleteAt: nextMonthDate,
        });
      }
    } catch (error) {
      logger.error('Error deleting user', { userId, error });
      throw new DatabaseError('Failed to delete user');
    }
  }

  public async updateUser(userId: string, plan: PlanType): Promise<void> {
    try {
      const planLimitPath = `lengthOfDocs.${plan}.current`;

      const result = await User.updateOne(
        {
          userId,
          status: 'active',
          [planLimitPath]: { $gt: 0 },
        },
        {
          $inc: { [planLimitPath]: -1 },
          $set: { updatedAt: new Date() },
        },
      ).exec();

      if (result.modifiedCount > 0) {
        await cacheService.invalidateTag(this.getUserTag(userId));
      }
    } catch (error) {
      logger.error(
        'Failed to decrease user docs limit after document processing',
        {
          userId,
          plan,
          error,
        },
      );
      throw new DatabaseError(`Failed to update user details`);
    }
  }

  public async checkIfUserExist(req: Request): Promise<UserDTO | null> {
    const userId = req.userId;
    const userEmail = req.email;
    const cacheKey = `user:${userId}`;

    const user = await cacheService.getOrFetch<QuotaResetUser | null>(
      cacheKey,
      async () => {
        logger.info('Cache miss: fetching user from DB', { userEmail });

        const dbUser = await User.findOne({ email: userEmail })
          .select('-__v')
          .lean()
          .exec();

        if (!dbUser) return null;
        if (dbUser.status === 'deleted' || dbUser.status === 'disabled') {
          logger.warn(
            'Blocked user attempted access in the same month of deletion',
            { userId },
          );
          throw new ReregistrationBlockedError();
        }

        await cacheService.addToTag(this.getUserTag(userId), cacheKey);

        return {
          userId: String(dbUser.userId),
          plan: dbUser.plan,
          lengthOfDocs: dbUser.lengthOfDocs,
          email: dbUser.email,
          monthlyQuotaResetAt: dbUser.monthlyQuotaResetAt,
        };
      },
      3600,
    );

    if (!user) return null;

    logger.info(
      'Checking and performing monthly quota reset if required:',
      user,
    );

    // 2. Eventual Consistency Reset Logic
    if (this.isResetRequired(user.monthlyQuotaResetAt)) {
      const now = new Date();
      const startOfCurrentMonth = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
      );

      // ATOMIC UPDATE: Only one request per month will have modifiedCount > 0
      const userUpdate = await User.updateOne(
        {
          userId,
          $or: [
            { monthlyQuotaResetAt: { $lt: startOfCurrentMonth } },
            { monthlyQuotaResetAt: { $exists: false } },
          ],
        },
        {
          $set: {
            lengthOfDocs: PlanLimits,
            monthlyQuotaResetAt: startOfCurrentMonth,
          },
        },
      ).exec();

      if (userUpdate.modifiedCount > 0) {
        try {
          await Document.updateMany(
            { userId },
            { $set: { chatBotPrompt: ChatbotPlanLimits } },
          ).exec();

          // Clear cache so the NEXT request gets the fresh values
          await cacheService.invalidateTag(this.getUserTag(userId));
          logger.info('New Month Detected - Resetting Quotas', { userId });
        } catch (error) {
          logger.error('Document reset failed, rolling back user timestamp', {
            userId,
            error: ErrorSerializer.serialize(error),
          });
          try {
            await User.updateOne(
              { userId },
              {
                $set: {
                  monthlyQuotaResetAt: new Date(
                    startOfCurrentMonth.getTime() - 1,
                  ),
                },
              },
            ).exec();
          } catch (rollbackError) {
            logger.error('Critical: Rollback failed', {
              userId,
              rollbackError,
            });
          }
        }
      }
    } else {
      logger.info('Monthly quota reset not required', { userId });
    }

    return user;
  }

  private isResetRequired(lastResetDate: Date): boolean {
    const now = new Date();
    const lastReset = new Date(lastResetDate);
    return (
      lastReset.getUTCFullYear() !== now.getUTCFullYear() ||
      lastReset.getUTCMonth() !== now.getUTCMonth()
    );
  }

  async createUserFromToken(req: Request): Promise<UserDTO> {
    const userId = req.userId;
    const email = req.email;
    const username = req.username;

    try {
      const newUser = await User.create({ userId, email, username });

      const userDto: UserDTO = {
        userId: String(newUser.userId),
        plan: newUser.plan,
        lengthOfDocs: newUser.lengthOfDocs,
        email: newUser.email,
      };

      // ✅ WARM THE CACHE: Immediately store the user in Redis
      const cacheKey = `user:${userId}`;
      await cacheService.set(
        cacheKey,
        { ...userDto, monthlyQuotaResetAt: newUser.monthlyQuotaResetAt },
        3600,
      );
      await cacheService.addToTag(this.getUserTag(userId), cacheKey);

      logger.info('New user created successfully', { userId, email });

      return userDto;
    } catch (error: any) {
      if (error.code === 11000) {
        logger.warn('User creation failed: Email exists (Duplicate Key)', {
          email,
        });
        throw new ReregistrationBlockedError();
      }
      logger.error('Error creating user', {
        userId,
        email,
        error: ErrorSerializer.serialize(error),
      });
      throw new DatabaseError('Failed to create user');
    }
  }

  async changeUserPlan(userId: string, targetPlan: PlanType): Promise<void> {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const { limits, botLimits } = getPlanMetadata(targetPlan);

      const updatedUser = await User.findOneAndUpdate(
        { userId, status: 'active' },
        {
          $set: {
            plan: targetPlan,
            lengthOfDocs: { [targetPlan]: limits },
            updatedAt: new Date(),
          },
        },
        { session, new: true },
      ).exec();

      if (!updatedUser) throw new UserNotFoundError();

      await Document.updateMany(
        { userId },
        { $set: { chatBotPrompt: { [targetPlan]: botLimits } } },
        { session },
      );

      await session.commitTransaction();
      await cacheService.invalidateTag(this.getUserTag(userId));
      logger.info(`Plan changed to ${targetPlan} for user ${userId}`);
    } catch (error) {
      await session.abortTransaction();
      logger.error('Plan change failed, transaction rolled back', {
        userId,
        error,
      });
      if (error instanceof UserNotFoundError) throw error;
      throw new DatabaseError('Failed to change user plan');
    } finally {
      session.endSession();
    }
  }
}
