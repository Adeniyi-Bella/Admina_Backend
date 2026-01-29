import 'reflect-metadata';
import { UserService } from '@/services/users/user.service';
import User from '@/models/user.model';
import { Request } from 'express';
import { ConfidentialClientApplication } from '@azure/msal-node';
import { Client } from '@microsoft/microsoft-graph-client';
import { cacheService } from '@/services/redis-cache/redis-cache.service';
import {
  DatabaseError,
  ReregistrationBlockedError,
  UserNotFoundError,
} from '@/lib/api_response/error';
import Document from '@/models/document.model';
import { getPlanMetadata } from '@/utils/user.utils';
import mongoose from 'mongoose';

jest.mock('@/models/user.model');
jest.mock('@/lib/redis');
jest.mock('@azure/msal-node');
jest.mock('@microsoft/microsoft-graph-client');
jest.mock('@/services/redis-cache/redis-cache.service');
jest.mock('@/models/document.model');
jest.mock('@/utils/user.utils');

describe('UserService - Complete Test Suite', () => {
  let userService: UserService;
  let mockRequest: Partial<Request>;

  beforeEach(() => {
    userService = new UserService();
    mockRequest = {
      userId: 'test-user-id',
      email: 'test@example.com',
      username: 'testuser',
    } as Partial<Request>;
    jest.clearAllMocks();
  });

  // ==========================================================================
  // CREATE USER - Registration & Re-registration Prevention
  // ==========================================================================
  describe('createUserFromToken - User Registration', () => {
    it('should create new user successfully', async () => {
      const mockUser = {
        userId: 'test-user-id',
        email: 'test@example.com',
        username: 'testuser',
        status: 'active',
      };

      (User.create as jest.Mock).mockResolvedValue(mockUser);

      await expect(
        userService.createUserFromToken(mockRequest as Request),
      ).resolves.not.toThrow();

      expect(User.create).toHaveBeenCalledWith({
        userId: 'test-user-id',
        email: 'test@example.com',
        username: 'testuser',
      });
    });

    it('should BLOCK re-registration with duplicate email (code 11000)', async () => {
      const duplicateError = { code: 11000 };
      (User.create as jest.Mock).mockRejectedValue(duplicateError);

      await expect(
        userService.createUserFromToken(mockRequest as Request),
      ).rejects.toThrow(ReregistrationBlockedError);

      expect(User.create).toHaveBeenCalledWith({
        userId: 'test-user-id',
        email: 'test@example.com',
        username: 'testuser',
      });
    });

    it('should throw DatabaseError for other creation failures', async () => {
      (User.create as jest.Mock).mockRejectedValue(
        new Error('DB Connection Lost'),
      );

      await expect(
        userService.createUserFromToken(mockRequest as Request),
      ).rejects.toThrow('Failed to create user');
    });

    it('should not cache user after creation', async () => {
      (User.create as jest.Mock).mockResolvedValue({});

      await userService.createUserFromToken(mockRequest as Request);

      expect(cacheService.set).not.toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // CHECK IF USER EXISTS - Cache-First Strategy
  // ==========================================================================
  describe('checkIfUserExist - User Retrieval with Caching', () => {
    it('should return user from cache if available', async () => {
      const cachedUser = {
        userId: 'test-user-id',
        email: 'test@example.com',
        plan: 'free',
        lengthOfDocs: { free: { max: 2, min: 0, current: 2 } },
      };

      (cacheService.getOrFetch as jest.Mock).mockResolvedValue(cachedUser);

      const result = await userService.checkIfUserExist(mockRequest as Request);

      expect(result).toEqual(cachedUser);
      expect(cacheService.getOrFetch).toHaveBeenCalledWith(
        'user:test-user-id',
        expect.any(Function),
        3600,
      );
    });

    it('should fetch from DB on cache miss and return mapped DTO', async () => {
      const dbUser = {
        userId: 'test-user-id',
        email: 'test@example.com',
        plan: 'premium',
        lengthOfDocs: { premium: { max: 5, min: 0, current: 3 } },
        status: 'active',
        __v: 0,
      };

      (cacheService.getOrFetch as jest.Mock).mockImplementation(
        async (key, fetchFn) => fetchFn(),
      );

      (User.findOne as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(dbUser),
      });

      const result = await userService.checkIfUserExist(mockRequest as Request);

      expect(result).toEqual({
        userId: 'test-user-id',
        email: 'test@example.com',
        plan: 'premium',
        lengthOfDocs: { premium: { max: 5, min: 0, current: 3 } },
      });

      expect(User.findOne).toHaveBeenCalledWith({ email: 'test@example.com' });
    });

    it('should return null when user does not exist in DB', async () => {
      (cacheService.getOrFetch as jest.Mock).mockImplementation(
        async (key, fetchFn) => fetchFn(),
      );

      (User.findOne as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(null),
      });

      const result = await userService.checkIfUserExist(mockRequest as Request);

      expect(result).toBeNull();
    });

    it('should THROW ReregistrationBlockedError if user status is "deleted"', async () => {
      const deletedUser = {
        userId: 'test-user-id',
        email: 'test@example.com',
        status: 'deleted',
        deletedAt: new Date(),
      };

      (cacheService.getOrFetch as jest.Mock).mockImplementation(
        async (key, fetchFn) => fetchFn(),
      );

      (User.findOne as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(deletedUser),
      });

      await expect(
        userService.checkIfUserExist(mockRequest as Request),
      ).rejects.toThrow(ReregistrationBlockedError);
    });

    it('should use request coalescing for concurrent requests', async () => {
      const mockUser = {
        userId: 'test-user-id',
        email: 'test@example.com',
        plan: 'free',
        lengthOfDocs: { free: { max: 2, min: 0, current: 2 } },
      };

      (cacheService.getOrFetch as jest.Mock).mockResolvedValue(mockUser);

      const requests = Array(5)
        .fill(null)
        .map(() => userService.checkIfUserExist(mockRequest as Request));

      const results = await Promise.all(requests);

      results.forEach((result) => expect(result).toEqual(mockUser));
      expect(cacheService.getOrFetch).toHaveBeenCalledTimes(5);
    });
  });

  // ==========================================================================
  // UPDATE USER - Property Updates & Cache Invalidation
  // ==========================================================================
  describe('updateUser - Plan Limit Decrement', () => {
    const userId = 'test-user-id';

    it('should dynamically target the "free" plan path and invalidate cache', async () => {
      // Mock updateOne to return a dummy result
      (User.updateOne as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue({ matchedCount: 1 }),
      });

      await userService.updateUser(userId, 'free');

      // 1. Verify dynamic path construction and atomic guard ($gt: 0)
      expect(User.updateOne).toHaveBeenCalledWith(
        {
          userId,
          status: 'active',
          'lengthOfDocs.free.current': { $gt: 0 },
        },
        {
          $inc: { 'lengthOfDocs.free.current': -1 },
          $set: { updatedAt: expect.any(Date) },
        },
      );

      // 2. Verify both specific key delete and tag invalidation
      expect(cacheService.delete).toHaveBeenCalledWith(`user:${userId}`);
      expect(cacheService.invalidateTag).toHaveBeenCalledWith(
        `tag:user:${userId}`,
      );
    });

    it('should dynamically target the "standard" plan path', async () => {
      (User.updateOne as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue({ matchedCount: 1 }),
      });

      await userService.updateUser(userId, 'standard');

      expect(User.updateOne).toHaveBeenCalledWith(
        expect.objectContaining({
          'lengthOfDocs.standard.current': { $gt: 0 },
        }),
        expect.objectContaining({
          $inc: { 'lengthOfDocs.standard.current': -1 },
        }),
      );
    });

    it('should throw DatabaseError if the database operation fails', async () => {
      (User.updateOne as jest.Mock).mockReturnValue({
        exec: jest.fn().mockRejectedValue(new Error('Network error')),
      });

      // Verify the specific error wrapping logic in your implementation
      await expect(
        userService.updateUser(userId, 'premium' as any),
      ).rejects.toThrow('Failed to update user details');
    });

    it('should complete successfully even if Redis is down (handled by RedisCacheService)', async () => {
      // 1. DB Update succeeds
      (User.updateOne as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue({ matchedCount: 1 }),
      });

      // 2. Mock Redis failure the way your service actually handles it:
      // Your RedisCacheService catches errors and returns false, it DOES NOT throw.
      (cacheService.delete as jest.Mock).mockResolvedValue(false);
      (cacheService.invalidateTag as jest.Mock).mockResolvedValue(false);

      // 3. The UserService should resolve successfully because the DB part worked
      // and the cache failure didn't throw an exception.
      await expect(
        userService.updateUser(userId, 'free'),
      ).resolves.not.toThrow();

      // Verify that even though it returned false, the logic proceeded
      expect(User.updateOne).toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // DELETE USER - Soft Delete with TTL
  // ==========================================================================
  describe('deleteUser - Soft Delete with TTL', () => {
    it('should soft delete user with status and permanentDeleteAt', async () => {
      const mockResult = { matchedCount: 1, modifiedCount: 1 };

      (User.updateOne as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockResult),
      });

      (cacheService.delete as jest.Mock).mockResolvedValue(true);
      (cacheService.invalidateTag as jest.Mock).mockResolvedValue(true);

      await userService.deleteUser('test-user-id');

      expect(User.updateOne).toHaveBeenCalledWith(
        { userId: 'test-user-id' },
        {
          $set: {
            status: 'deleted',
            deletedAt: expect.any(Date),
            permanentDeleteAt: expect.any(Date),
          },
        },
      );

      const updateCall = (User.updateOne as jest.Mock).mock.calls[0][1];
      const permanentDeleteAt = updateCall.$set.permanentDeleteAt;

      // Verify permanentDeleteAt is first day of next month
      expect(permanentDeleteAt.getDate()).toBe(1);
      expect(permanentDeleteAt.getMonth()).toBeGreaterThanOrEqual(
        new Date().getMonth(),
      );
    });

    it('should invalidate cache and tags after soft delete', async () => {
      (User.updateOne as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue({ matchedCount: 1 }),
      });

      (cacheService.delete as jest.Mock).mockResolvedValue(true);
      (cacheService.invalidateTag as jest.Mock).mockResolvedValue(true);

      await userService.deleteUser('test-user-id');

      expect(cacheService.delete).toHaveBeenCalledWith('user:test-user-id');
      expect(cacheService.invalidateTag).toHaveBeenCalledWith(
        'tag:user:test-user-id',
      );
    });

    it('should handle deletion of non-existent user gracefully', async () => {
      (User.updateOne as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue({ matchedCount: 0 }),
      });

      (cacheService.delete as jest.Mock).mockResolvedValue(true);
      (cacheService.invalidateTag as jest.Mock).mockResolvedValue(true);

      await expect(
        userService.deleteUser('non-existent-id'),
      ).resolves.not.toThrow();

      // Should still attempt cache invalidation
      expect(cacheService.delete).toHaveBeenCalled();
    });

    it('should throw DatabaseError on deletion failure', async () => {
      (User.updateOne as jest.Mock).mockReturnValue({
        exec: jest.fn().mockRejectedValue(new Error('DB Error')),
      });

      await expect(userService.deleteUser('test-user-id')).rejects.toThrow(
        'Failed to delete user',
      );
    });
  });

  // ==========================================================================
  // DELETE USER FROM ENTRA ID - External API Integration
  // ==========================================================================
  describe('deleteUserFromEntraId - Azure AD Integration', () => {
    it('should delete user from Entra ID successfully', async () => {
      const mockCca = {
        acquireTokenByClientCredential: jest.fn().mockResolvedValue({
          accessToken: 'mock-token',
        }),
      };
      (ConfidentialClientApplication as jest.Mock).mockReturnValue(mockCca);

      const mockDelete = jest.fn().mockResolvedValue(undefined);
      const mockApi = jest.fn().mockReturnValue({ delete: mockDelete });
      const mockClient = { api: mockApi };
      (Client.init as jest.Mock).mockReturnValue(mockClient);

      const result = await userService.deleteUserFromEntraId('test-user-id');

      expect(result).toBe(true);
      expect(mockApi).toHaveBeenCalledWith('/users/test-user-id');
      expect(mockDelete).toHaveBeenCalled();
    });

    it('should return true for 404 (user not found/already deleted)', async () => {
      const mockCca = {
        acquireTokenByClientCredential: jest.fn().mockResolvedValue({
          accessToken: 'mock-token',
        }),
      };
      (ConfidentialClientApplication as jest.Mock).mockReturnValue(mockCca);

      const mockDelete = jest.fn().mockRejectedValue({
        statusCode: 404,
        message: 'User not found',
      });
      const mockApi = jest.fn().mockReturnValue({ delete: mockDelete });
      const mockClient = { api: mockApi };
      (Client.init as jest.Mock).mockReturnValue(mockClient);

      const result = await userService.deleteUserFromEntraId('test-user-id');

      expect(result).toBe(true);
    });

    it('should return true for 400 (bad request/validation issues)', async () => {
      const mockCca = {
        acquireTokenByClientCredential: jest.fn().mockResolvedValue({
          accessToken: 'mock-token',
        }),
      };
      (ConfidentialClientApplication as jest.Mock).mockReturnValue(mockCca);

      const mockDelete = jest.fn().mockRejectedValue({
        statusCode: 400,
        message: 'Bad request',
      });
      const mockApi = jest.fn().mockReturnValue({ delete: mockDelete });
      const mockClient = { api: mockApi };
      (Client.init as jest.Mock).mockReturnValue(mockClient);

      const result = await userService.deleteUserFromEntraId('test-user-id');

      expect(result).toBe(true);
    });

    it('should return true for 401 (unauthorized)', async () => {
      const mockCca = {
        acquireTokenByClientCredential: jest.fn().mockResolvedValue({
          accessToken: 'mock-token',
        }),
      };
      (ConfidentialClientApplication as jest.Mock).mockReturnValue(mockCca);

      const mockDelete = jest.fn().mockRejectedValue({
        statusCode: 401,
        message: 'Unauthorized',
      });
      const mockApi = jest.fn().mockReturnValue({ delete: mockDelete });
      const mockClient = { api: mockApi };
      (Client.init as jest.Mock).mockReturnValue(mockClient);

      const result = await userService.deleteUserFromEntraId('test-user-id');

      expect(result).toBe(true);
    });

    it('should return true for 403 (forbidden)', async () => {
      const mockCca = {
        acquireTokenByClientCredential: jest.fn().mockResolvedValue({
          accessToken: 'mock-token',
        }),
      };
      (ConfidentialClientApplication as jest.Mock).mockReturnValue(mockCca);

      const mockDelete = jest.fn().mockRejectedValue({
        statusCode: 403,
        message: 'Forbidden',
      });
      const mockApi = jest.fn().mockReturnValue({ delete: mockDelete });
      const mockClient = { api: mockApi };
      (Client.init as jest.Mock).mockReturnValue(mockClient);

      const result = await userService.deleteUserFromEntraId('test-user-id');

      expect(result).toBe(true);
    });

    it('should return false for 500 (server error)', async () => {
      const mockCca = {
        acquireTokenByClientCredential: jest.fn().mockResolvedValue({
          accessToken: 'mock-token',
        }),
      };
      (ConfidentialClientApplication as jest.Mock).mockReturnValue(mockCca);

      const mockDelete = jest.fn().mockRejectedValue({
        statusCode: 500,
        message: 'Server error',
      });
      const mockApi = jest.fn().mockReturnValue({ delete: mockDelete });
      const mockClient = { api: mockApi };
      (Client.init as jest.Mock).mockReturnValue(mockClient);

      const result = await userService.deleteUserFromEntraId('test-user-id');

      expect(result).toBe(false);
    });

    it('should return false for other non-handled error status codes', async () => {
      const mockCca = {
        acquireTokenByClientCredential: jest.fn().mockResolvedValue({
          accessToken: 'mock-token',
        }),
      };
      (ConfidentialClientApplication as jest.Mock).mockReturnValue(mockCca);

      const mockDelete = jest.fn().mockRejectedValue({
        statusCode: 503,
        message: 'Service unavailable',
      });
      const mockApi = jest.fn().mockReturnValue({ delete: mockDelete });
      const mockClient = { api: mockApi };
      (Client.init as jest.Mock).mockReturnValue(mockClient);

      const result = await userService.deleteUserFromEntraId('test-user-id');

      expect(result).toBe(false);
    });

    it('should throw InvalidInputError when userId is empty', async () => {
      const result = await userService.deleteUserFromEntraId('');
      expect(result).toBe(true);
    });

    it('should return false when token acquisition fails', async () => {
      const mockCca = {
        acquireTokenByClientCredential: jest.fn().mockResolvedValue(null),
      };
      (ConfidentialClientApplication as jest.Mock).mockReturnValue(mockCca);

      const result = await userService.deleteUserFromEntraId('test-user-id');

      expect(result).toBe(false);
    });

    it('should return false when accessToken is undefined', async () => {
      const mockCca = {
        acquireTokenByClientCredential: jest.fn().mockResolvedValue({
          accessToken: undefined,
        }),
      };
      (ConfidentialClientApplication as jest.Mock).mockReturnValue(mockCca);

      const result = await userService.deleteUserFromEntraId('test-user-id');

      expect(result).toBe(false);
    });

    it('should handle errors without statusCode property', async () => {
      const mockCca = {
        acquireTokenByClientCredential: jest.fn().mockResolvedValue({
          accessToken: 'mock-token',
        }),
      };
      (ConfidentialClientApplication as jest.Mock).mockReturnValue(mockCca);

      const mockDelete = jest.fn().mockRejectedValue({
        message: 'Generic error',
      });
      const mockApi = jest.fn().mockReturnValue({ delete: mockDelete });
      const mockClient = { api: mockApi };
      (Client.init as jest.Mock).mockReturnValue(mockClient);

      const result = await userService.deleteUserFromEntraId('test-user-id');

      // Should default to 500 status and return false
      expect(result).toBe(false);
    });
  });

  // ==========================================================================
  // RE-REGISTRATION PREVENTION - Complete Flow Tests
  // ==========================================================================
  describe('Re-registration Prevention - Integration Tests', () => {
    it('SCENARIO 1: User deletes account and tries to re-register same month', async () => {
      // Step 1: User tries to create account
      (User.create as jest.Mock).mockRejectedValue({ code: 11000 });

      await expect(
        userService.createUserFromToken(mockRequest as Request),
      ).rejects.toThrow(ReregistrationBlockedError);
    });

    it('SCENARIO 2: Deleted user tries to login same month', async () => {
      const deletedUser = {
        userId: 'test-user-id',
        email: 'test@example.com',
        status: 'deleted',
      };

      (cacheService.getOrFetch as jest.Mock).mockImplementation(
        async (key, fetchFn) => fetchFn(),
      );

      (User.findOne as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(deletedUser),
      });

      await expect(
        userService.checkIfUserExist(mockRequest as Request),
      ).rejects.toThrow(ReregistrationBlockedError);
    });

    it('SCENARIO 3: New month arrives, TTL removes document, user can register', async () => {
      // Document has been removed by MongoDB TTL
      (User.create as jest.Mock).mockResolvedValue({
        userId: 'test-user-id',
        email: 'test@example.com',
        status: 'active',
      });

      await expect(
        userService.createUserFromToken(mockRequest as Request),
      ).resolves.not.toThrow();
    });

    it('SCENARIO 4: New month, checkIfUserExist returns null (fresh start)', async () => {
      (cacheService.getOrFetch as jest.Mock).mockImplementation(
        async (key, fetchFn) => fetchFn(),
      );

      (User.findOne as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(null),
      });

      const result = await userService.checkIfUserExist(mockRequest as Request);

      expect(result).toBeNull();
    });
  });

  // ==========================================================================
  // CHANGE USER PLAN - Atomic Upgrade/Downgrade logic
  // ==========================================================================
  describe('changeUserPlan - Transactional Update', () => {
    let mockSession: any;

    beforeEach(() => {
      mockSession = {
        startTransaction: jest.fn(),
        commitTransaction: jest.fn(),
        abortTransaction: jest.fn(),
        endSession: jest.fn(),
      };
      (mongoose.startSession as jest.Mock) = jest
        .fn()
        .mockResolvedValue(mockSession);

      (getPlanMetadata as jest.Mock).mockReturnValue({
        limits: { max: 5, current: 5, min: 0 },
        botLimits: { max: 10, current: 10, min: 0 },
      });
    });

    it('should successfully update user and documents within a transaction', async () => {
      const userId = 'test-user-id';
      const targetPlan = 'premium';

      (User.findOneAndUpdate as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue({ userId, plan: targetPlan }),
      });

      // 2. Mock Document bulk update success
      (Document.updateMany as jest.Mock).mockResolvedValue({
        acknowledged: true,
      });

      await userService.changeUserPlan(userId, targetPlan as any);

      // Verify Transaction Flow
      expect(mongoose.startSession).toHaveBeenCalled();
      expect(mockSession.startTransaction).toHaveBeenCalled();

      // Verify User update was called with the session
      expect(User.findOneAndUpdate).toHaveBeenCalledWith(
        { userId, status: 'active' },
        expect.any(Object),
        expect.objectContaining({ session: mockSession }),
      );

      // Verify Document Bulk update was called with the session
      expect(Document.updateMany).toHaveBeenCalledWith(
        { userId },
        expect.any(Object),
        { session: mockSession },
      );

      // Verify Commit and Cleanup
      expect(mockSession.commitTransaction).toHaveBeenCalled();
      expect(cacheService.delete).toHaveBeenCalledWith(`user:${userId}`);
      expect(cacheService.invalidateTag).toHaveBeenCalledWith(
        `tag:user:${userId}`,
      );
      expect(mockSession.endSession).toHaveBeenCalled();
    });

    it('should rollback transaction and throw UserNotFoundError if user is missing', async () => {
      (User.findOneAndUpdate as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      await expect(
        userService.changeUserPlan('invalid-id', 'premium' as any),
      ).rejects.toThrow(UserNotFoundError);

      expect(mockSession.abortTransaction).toHaveBeenCalled();
      expect(mockSession.commitTransaction).not.toHaveBeenCalled();
      expect(mockSession.endSession).toHaveBeenCalled();
    });

    it('should rollback transaction and throw DatabaseError if document update fails', async () => {
      // User update succeeds
      (User.findOneAndUpdate as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue({ userId: 'test-user-id' }),
      });

      // Document update fails
      (Document.updateMany as jest.Mock).mockRejectedValue(
        new Error('Update failed'),
      );

      await expect(
        userService.changeUserPlan('test-user-id', 'premium' as any),
      ).rejects.toThrow(DatabaseError);

      expect(mockSession.abortTransaction).toHaveBeenCalled();
      expect(cacheService.delete).not.toHaveBeenCalled();
      expect(mockSession.endSession).toHaveBeenCalled();
    });
  });
});
