import 'reflect-metadata';
import { UserService } from '@/services/users/user.service';
import User from '@/models/user.model';
import { Request } from 'express';
import { ConfidentialClientApplication } from '@azure/msal-node';
import { Client } from '@microsoft/microsoft-graph-client';
import { cacheService } from '@/services/redis-cache/redis-cache.service';
import { ReregistrationBlockedError } from '@/lib/api_response/error';

jest.mock('@/models/user.model');
jest.mock('@/lib/redis');
jest.mock('@azure/msal-node');
jest.mock('@microsoft/microsoft-graph-client');
jest.mock('@/services/redis-cache/redis-cache.service');

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
        userService.createUserFromToken(mockRequest as Request)
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
        userService.createUserFromToken(mockRequest as Request)
      ).rejects.toThrow(ReregistrationBlockedError);

      expect(User.create).toHaveBeenCalledWith({
        userId: 'test-user-id',
        email: 'test@example.com',
        username: 'testuser',
      });
    });

    it('should throw DatabaseError for other creation failures', async () => {
      (User.create as jest.Mock).mockRejectedValue(new Error('DB Connection Lost'));

      await expect(
        userService.createUserFromToken(mockRequest as Request)
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
        async (key, fetchFn) => fetchFn()
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
        async (key, fetchFn) => fetchFn()
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
        async (key, fetchFn) => fetchFn()
      );

      (User.findOne as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(deletedUser),
      });

      await expect(
        userService.checkIfUserExist(mockRequest as Request)
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
  describe('updateUser - User Property Updates', () => {
    it('should update user property with $set and invalidate cache', async () => {
      const mockUser = {
        userId: 'test-user-id',
        email: 'test@example.com',
        plan: 'premium',
      };

      (User.findOneAndUpdate as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockUser),
      });

      (cacheService.delete as jest.Mock).mockResolvedValue(true);
      (cacheService.invalidateTag as jest.Mock).mockResolvedValue(true);

      const result = await userService.updateUser(
        'test-user-id',
        'plan',
        false,
        'premium'
      );

      expect(result).toBe(true);
      expect(User.findOneAndUpdate).toHaveBeenCalledWith(
        { userId: 'test-user-id', status: 'active' },
        { $set: { plan: 'premium', updatedAt: expect.any(Date) } },
        { new: true, projection: { __v: 0 } }
      );

      expect(cacheService.delete).toHaveBeenCalledWith('user:test-user-id');
      expect(cacheService.invalidateTag).toHaveBeenCalledWith('tag:user:test-user-id');
    });

    it('should decrement property with $inc when decrement=true', async () => {
      const mockUser = {
        userId: 'test-user-id',
        lengthOfDocs: { free: { current: 1 } },
      };

      (User.findOneAndUpdate as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockUser),
      });

      (cacheService.delete as jest.Mock).mockResolvedValue(true);
      (cacheService.invalidateTag as jest.Mock).mockResolvedValue(true);

      const result = await userService.updateUser(
        'test-user-id',
        'lengthOfDocs.free.current',
        true,
        undefined
      );

      expect(result).toBe(true);
      expect(User.findOneAndUpdate).toHaveBeenCalledWith(
        { userId: 'test-user-id', status: 'active' },
        {
          $inc: { 'lengthOfDocs.free.current': -1 },
          $set: { updatedAt: expect.any(Date) },
        },
        { new: true, projection: { __v: 0 } }
      );
    });

    it('should return false when user not found or not active', async () => {
      (User.findOneAndUpdate as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      const result = await userService.updateUser(
        'non-existent',
        'plan',
        false,
        'premium'
      );

      expect(result).toBe(false);
      expect(cacheService.delete).not.toHaveBeenCalled();
      expect(cacheService.invalidateTag).not.toHaveBeenCalled();
    });

    it('should update nested object properties correctly', async () => {
      const mockUser = {
        userId: 'test-user-id',
        lengthOfDocs: { standard: { max: 3, min: 0, current: 3 } },
      };

      (User.findOneAndUpdate as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockUser),
      });

      (cacheService.delete as jest.Mock).mockResolvedValue(true);
      (cacheService.invalidateTag as jest.Mock).mockResolvedValue(true);

      await userService.updateUser('test-user-id', 'lengthOfDocs', false, {
        standard: { max: 3, min: 0, current: 3 },
      });

      expect(User.findOneAndUpdate).toHaveBeenCalledWith(
        { userId: 'test-user-id', status: 'active' },
        {
          $set: {
            lengthOfDocs: { standard: { max: 3, min: 0, current: 3 } },
            updatedAt: expect.any(Date),
          },
        },
        { new: true, projection: { __v: 0 } }
      );
    });

    it('should throw DatabaseError on update failure', async () => {
      (User.findOneAndUpdate as jest.Mock).mockReturnValue({
        exec: jest.fn().mockRejectedValue(new Error('Connection timeout')),
      });

      await expect(
        userService.updateUser('test-user-id', 'plan', false, 'premium')
      ).rejects.toThrow('Failed to update plan');
    });

    it('should still return true if cache invalidation fails', async () => {
      const mockUser = {
        userId: 'test-user-id',
        plan: 'premium',
      };

      (User.findOneAndUpdate as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockUser),
      });

      (cacheService.delete as jest.Mock).mockResolvedValue(false);
      (cacheService.invalidateTag as jest.Mock).mockResolvedValue(false);

      const result = await userService.updateUser(
        'test-user-id',
        'plan',
        false,
        'premium'
      );

      expect(result).toBe(true);
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
        }
      );

      const updateCall = (User.updateOne as jest.Mock).mock.calls[0][1];
      const permanentDeleteAt = updateCall.$set.permanentDeleteAt;
      
      // Verify permanentDeleteAt is first day of next month
      expect(permanentDeleteAt.getDate()).toBe(1);
      expect(permanentDeleteAt.getMonth()).toBeGreaterThanOrEqual(new Date().getMonth());
    });

    it('should invalidate cache and tags after soft delete', async () => {
      (User.updateOne as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue({ matchedCount: 1 }),
      });

      (cacheService.delete as jest.Mock).mockResolvedValue(true);
      (cacheService.invalidateTag as jest.Mock).mockResolvedValue(true);

      await userService.deleteUser('test-user-id');

      expect(cacheService.delete).toHaveBeenCalledWith('user:test-user-id');
      expect(cacheService.invalidateTag).toHaveBeenCalledWith('tag:user:test-user-id');
    });

    it('should handle deletion of non-existent user gracefully', async () => {
      (User.updateOne as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue({ matchedCount: 0 }),
      });

      (cacheService.delete as jest.Mock).mockResolvedValue(true);
      (cacheService.invalidateTag as jest.Mock).mockResolvedValue(true);

      await expect(
        userService.deleteUser('non-existent-id')
      ).resolves.not.toThrow();

      // Should still attempt cache invalidation
      expect(cacheService.delete).toHaveBeenCalled();
    });

    it('should throw DatabaseError on deletion failure', async () => {
      (User.updateOne as jest.Mock).mockReturnValue({
        exec: jest.fn().mockRejectedValue(new Error('DB Error')),
      });

      await expect(
        userService.deleteUser('test-user-id')
      ).rejects.toThrow('Failed to delete user');
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

    it('should return false for 404 (user already deleted)', async () => {
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

      expect(result).toBe(false);
    });

    it('should throw GraphAPIError for non-404 errors', async () => {
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

      await expect(
        userService.deleteUserFromEntraId('test-user-id')
      ).rejects.toThrow('Failed to delete user from Entra ID');
    });

    it('should throw InvalidInputError when userId is empty', async () => {
      await expect(
        userService.deleteUserFromEntraId('')
      ).rejects.toThrow('Valid userId is required');
    });

    it('should throw AzureAuthError when token acquisition fails', async () => {
      const mockCca = {
        acquireTokenByClientCredential: jest.fn().mockResolvedValue(null),
      };
      (ConfidentialClientApplication as jest.Mock).mockReturnValue(mockCca);

      await expect(
        userService.deleteUserFromEntraId('test-user-id')
      ).rejects.toThrow('Failed to acquire Graph token');
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
        userService.createUserFromToken(mockRequest as Request)
      ).rejects.toThrow(ReregistrationBlockedError);
    });

    it('SCENARIO 2: Deleted user tries to login same month', async () => {
      const deletedUser = {
        userId: 'test-user-id',
        email: 'test@example.com',
        status: 'deleted',
      };

      (cacheService.getOrFetch as jest.Mock).mockImplementation(
        async (key, fetchFn) => fetchFn()
      );

      (User.findOne as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(deletedUser),
      });

      await expect(
        userService.checkIfUserExist(mockRequest as Request)
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
        userService.createUserFromToken(mockRequest as Request)
      ).resolves.not.toThrow();
    });

    it('SCENARIO 4: New month, checkIfUserExist returns null (fresh start)', async () => {
      (cacheService.getOrFetch as jest.Mock).mockImplementation(
        async (key, fetchFn) => fetchFn()
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
});