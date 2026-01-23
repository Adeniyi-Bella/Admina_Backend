import 'reflect-metadata';
import { UserService } from '@/services/users/user.service';
import User from '@/models/user.model';
import DeletedUsers from '@/models/deletedUsers.model';
import { Request } from 'express';
import { ConfidentialClientApplication } from '@azure/msal-node';
import { Client } from '@microsoft/microsoft-graph-client';
import { cacheService } from '@/services/redis-cache/redis-cache.service';

jest.mock('@/models/user.model');
jest.mock('@/models/deletedUsers.model');
jest.mock('@/lib/redis');
jest.mock('@azure/msal-node');
jest.mock('@microsoft/microsoft-graph-client');
jest.mock('@/services/redis-cache/redis-cache.service');

describe('UserService - Testing', () => {
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

  describe('checkIfUserExist - Request Coalescing & Cache-Aside', () => {
    /**
     * CRITICAL: Request coalescing prevents thundering herd
     * Only ONE DB query should execute for multiple concurrent requests
     */
    it('should use request coalescing for concurrent requests', async () => {
      const mockUser = {
        userId: 'test-user-id',
        email: 'test@example.com',
        plan: 'free',
        lengthOfDocs: { free: { max: 2, min: 0, current: 2 } },
      };

      // Mock cache miss, then DB fetch
      (cacheService.getOrFetch as jest.Mock).mockResolvedValue(mockUser);

      (User.findOne as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(mockUser),
      });

      // Simulate 5 concurrent requests
      const requests = Array(5)
        .fill(null)
        .map(() => userService.checkIfUserExist(mockRequest as Request));

      const results = await Promise.all(requests);

      // All should return the same user
      results.forEach((result) => expect(result).toEqual(mockUser));

      // getOrFetch should handle coalescing internally
      expect(cacheService.getOrFetch).toHaveBeenCalledTimes(5);
    });

    it('should return cached user without DB query', async () => {
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

    it('should handle cache service failure gracefully (circuit breaker)', async () => {
      const mockUser = {
        userId: 'test-user-id',
        email: 'test@example.com',
        plan: 'free',
        lengthOfDocs: { free: { max: 2, min: 0, current: 2 } },
      };

      // Simulate cache failure, but getOrFetch still works (falls back to DB)
      (cacheService.getOrFetch as jest.Mock).mockResolvedValue(mockUser);

      const result = await userService.checkIfUserExist(mockRequest as Request);

      expect(result).toEqual(mockUser);
    });
  });

  describe('updateUser - Cache Invalidation (Delete)', () => {
    /**
     * CRITICAL: Must DELETE cache on write, not update
     * This prevents race conditions in concurrent writes
     */
    it('should invalidate cache on user update', async () => {
      const mockUser = {
        userId: 'test-user-id',
        email: 'test@example.com',
        plan: 'premium',
        lengthOfDocs: { premium: { max: 5, min: 0, current: 5 } },
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
        'premium',
      );

      expect(result).toBe(true);

      // CRITICAL: Should DELETE cache, not SET
      expect(cacheService.delete).toHaveBeenCalledWith('user:test-user-id');
      expect(cacheService.invalidateTag).toHaveBeenCalledWith(
        'tag:user:test-user-id',
      );
    });

    it('should invalidate cache on decrement operation', async () => {
      const mockUser = {
        userId: 'test-user-id',
        email: 'test@example.com',
        plan: 'free',
        lengthOfDocs: { free: { max: 2, min: 0, current: 1 } },
      };

      (User.findOneAndUpdate as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockUser),
      });

      (cacheService.delete as jest.Mock).mockResolvedValue(true);
      (cacheService.invalidateTag as jest.Mock).mockResolvedValue(true);

      await userService.updateUser(
        'test-user-id',
        'lengthOfDocs.free.current',
        true,
        undefined,
      );

      expect(cacheService.delete).toHaveBeenCalledWith('user:test-user-id');
      expect(cacheService.invalidateTag).toHaveBeenCalledWith(
        'tag:user:test-user-id',
      );
    });

    it('should not invalidate cache when user not found', async () => {
      (User.findOneAndUpdate as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      const result = await userService.updateUser(
        'non-existent',
        'plan',
        false,
        'premium',
      );

      expect(result).toBe(false);
      expect(cacheService.delete).not.toHaveBeenCalled();
    });
  });

  describe('deleteUser - Cache & Tag Invalidation', () => {
    /**
     * CRITICAL: Must invalidate both specific cache and all tagged caches
     */
    it('should invalidate cache and tags on deletion', async () => {
      const mockUser = {
        userId: 'test-user-id',
        email: 'test@example.com',
      };

      (User.findOne as jest.Mock).mockResolvedValue(mockUser);
      (User.deleteOne as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue({ deletedCount: 1 }),
      });

      (cacheService.delete as jest.Mock).mockResolvedValue(true);
      (cacheService.invalidateTag as jest.Mock).mockResolvedValue(true);

      const result = await userService.deleteUser('test-user-id');

      expect(result).toBe('test@example.com');
      expect(cacheService.delete).toHaveBeenCalledWith('user:test-user-id');
      expect(cacheService.invalidateTag).toHaveBeenCalledWith(
        'tag:user:test-user-id',
      );
    });

    it('should not invalidate cache when user not found', async () => {
      (User.findOne as jest.Mock).mockResolvedValue(null);

      const result = await userService.deleteUser('non-existent');

      expect(result).toBeNull();
      expect(cacheService.delete).not.toHaveBeenCalled();
      expect(cacheService.invalidateTag).not.toHaveBeenCalled();
    });
  });

  describe('checkUserEligibility - Re-registration Prevention', () => {
    /**
     * CRITICAL: Users who delete their account cannot re-register
     * in the same month to prevent abuse
     */
    it('should prevent re-registration in the same month as deletion', async () => {
      const deletionDate = new Date('2025-01-15');
      const attemptDate = new Date('2025-01-20'); // Same month
      jest.useFakeTimers().setSystemTime(attemptDate);

      (DeletedUsers.findOne as jest.Mock).mockResolvedValue({
        email: 'test@example.com',
        deletedAt: deletionDate,
      });

      const mockDelete = jest.fn().mockResolvedValue(undefined);
      const mockApi = jest.fn().mockReturnValue({ delete: mockDelete });
      const mockClient = { api: mockApi };
      (Client.init as jest.Mock).mockReturnValue(mockClient);

      const mockCca = {
        acquireTokenByClientCredential: jest.fn().mockResolvedValue({
          accessToken: 'mock-token',
        }),
      };
      (ConfidentialClientApplication as jest.Mock).mockReturnValue(mockCca);

      await expect(
        userService.checkUserEligibility(mockRequest as Request),
      ).rejects.toThrow(
        'You cannot re-register in the same month you deleted your account.',
      );

      // Should attempt to delete from Entra ID
      expect(mockDelete).toHaveBeenCalled();

      jest.useRealTimers();
    });

    it('should allow re-registration in a different month', async () => {
      const deletionDate = new Date('2024-12-15');
      const attemptDate = new Date('2025-01-20'); // Different month
      jest.useFakeTimers().setSystemTime(attemptDate);

      const mockDeleteOne = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue({ deletedCount: 1 }),
      });

      (DeletedUsers.findOne as jest.Mock).mockResolvedValue({
        email: 'test@example.com',
        deletedAt: deletionDate,
      });

      (DeletedUsers.deleteOne as jest.Mock).mockReturnValue({
        exec: mockDeleteOne().exec,
      });

      await expect(
        userService.checkUserEligibility(mockRequest as Request),
      ).resolves.not.toThrow();

      expect(DeletedUsers.deleteOne).toHaveBeenCalledWith({
        email: 'test@example.com',
      });

      jest.useRealTimers();
    });

    it('should handle year boundary correctly (Dec to Jan)', async () => {
      const deletionDate = new Date('2024-12-31');
      const attemptDate = new Date('2025-01-01'); // Different month, different year
      jest.useFakeTimers().setSystemTime(attemptDate);

      const mockDeleteOne = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue({ deletedCount: 1 }),
      });

      (DeletedUsers.findOne as jest.Mock).mockResolvedValue({
        email: 'test@example.com',
        deletedAt: deletionDate,
      });

      (DeletedUsers.deleteOne as jest.Mock).mockReturnValue({
        exec: mockDeleteOne().exec,
      });

      await expect(
        userService.checkUserEligibility(mockRequest as Request),
      ).resolves.not.toThrow();

      jest.useRealTimers();
    });
    it('should allow registration for users not in DeletedUsers collection', async () => {
      (DeletedUsers.findOne as jest.Mock).mockResolvedValue(null);

      await expect(
        userService.checkUserEligibility(mockRequest as Request),
      ).resolves.not.toThrow();

      // Should not call deleteOne if user not found
      expect(DeletedUsers.deleteOne).not.toHaveBeenCalled();
    });

    it('should handle same month with different years (Jan 2024 vs Jan 2025)', async () => {
      const deletionDate = new Date('2024-01-15');
      const attemptDate = new Date('2025-01-15'); // Same month, different year
      jest.useFakeTimers().setSystemTime(attemptDate);

      (DeletedUsers.findOne as jest.Mock).mockResolvedValue({
        email: 'test@example.com',
        deletedAt: deletionDate,
      });

      (DeletedUsers.deleteOne as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue({ deletedCount: 1 }),
      });

      await expect(
        userService.checkUserEligibility(mockRequest as Request),
      ).resolves.not.toThrow();

      jest.useRealTimers();
    });
  });

  // ==========================================================================
  // DELETE USER FROM ENTRA ID - External API Integration
  // ==========================================================================
  describe('deleteUserFromEntraId - Azure AD Integration', () => {
    /**
     * BUSINESS RULE: Delete user from Azure AD (Entra ID)
     */
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
      expect(mockDelete).toHaveBeenCalled();
    });

    it('should handle 404 gracefully (user already deleted from Entra)', async () => {
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
        userService.deleteUserFromEntraId('test-user-id'),
      ).rejects.toThrow('Failed to delete user from Entra ID');
    });

    it('should throw InvalidInputError when userId is missing', async () => {
      await expect(userService.deleteUserFromEntraId('')).rejects.toThrow(
        'Valid userId is required',
      );
    });

    it('should throw AzureAuthError when token acquisition fails', async () => {
      const mockCca = {
        acquireTokenByClientCredential: jest.fn().mockResolvedValue(null),
      };
      (ConfidentialClientApplication as jest.Mock).mockReturnValue(mockCca);

      await expect(
        userService.deleteUserFromEntraId('test-user-id'),
      ).rejects.toThrow('Failed to acquire Graph token');
    });
  });

  // ==========================================================================
  // CREATE USER - User Registration Business Logic
  // ==========================================================================
  describe('createUserFromToken - User Registration', () => {
    /**
     * BUSINESS RULE: Create user from Azure AD token claims
     */
    it('should create user with userId, email, and username', async () => {
      (User.create as jest.Mock).mockResolvedValue({
        userId: 'test-user-id',
        email: 'test@example.com',
        username: 'testuser',
      });

      await userService.createUserFromToken(mockRequest as Request);

      expect(User.create).toHaveBeenCalledWith({
        userId: 'test-user-id',
        email: 'test@example.com',
        username: 'testuser',
      });
    });

    it('should throw DatabaseError when creation fails', async () => {
      (User.create as jest.Mock).mockRejectedValue(new Error('DB Error'));

      await expect(
        userService.createUserFromToken(mockRequest as Request),
      ).rejects.toThrow('Failed to create user');
    });

    it('should not cache user immediately after creation', async () => {
      (User.create as jest.Mock).mockResolvedValue({});

      await userService.createUserFromToken(mockRequest as Request);

      // Should not set cache on creation (lazy caching on first read)
      expect(cacheService.set).not.toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // CHECK IF USER EXISTS - Cache Strategy & User Retrieval
  // ==========================================================================
  describe('checkIfUserExist - User Retrieval with Caching', () => {
    /**
     * BUSINESS RULE: Retrieve user with cache-first strategy
     * CACHING RULE: Request coalescing to prevent thundering herd
     */
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

    it('should fetch from DB when cache misses and then cache result', async () => {
      const dbUser = {
        userId: 'test-user-id',
        email: 'test@example.com',
        plan: 'free',
        lengthOfDocs: { free: { max: 2, min: 0, current: 2 } },
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

      expect(result).toEqual(dbUser);
      expect(User.findOne).toHaveBeenCalledWith({ userId: 'test-user-id' });
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

    it('should use request coalescing for concurrent requests', async () => {
      const mockUser = {
        userId: 'test-user-id',
        email: 'test@example.com',
        plan: 'free',
        lengthOfDocs: { free: { max: 2, min: 0, current: 2 } },
      };

      (cacheService.getOrFetch as jest.Mock).mockResolvedValue(mockUser);

      // Simulate 5 concurrent requests
      const requests = Array(5)
        .fill(null)
        .map(() => userService.checkIfUserExist(mockRequest as Request));

      const results = await Promise.all(requests);

      results.forEach((result) => expect(result).toEqual(mockUser));
    });

    it('should map DB user to DTO correctly', async () => {
      const dbUser = {
        userId: 'test-user-id',
        email: 'test@example.com',
        plan: 'premium',
        lengthOfDocs: { premium: { max: 5, min: 0, current: 3 } },
        someInternalField: 'should-not-appear',
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

      // Should only include DTO fields
      expect(result).toEqual({
        userId: 'test-user-id',
        email: 'test@example.com',
        plan: 'premium',
        lengthOfDocs: { premium: { max: 5, min: 0, current: 3 } },
      });
    });
  });

  // ==========================================================================
  // UPDATE USER - Property Updates & Cache Invalidation
  // ==========================================================================
  describe('updateUser - User Property Updates', () => {
    /**
     * BUSINESS RULE: Update user properties and invalidate cache
     * CACHING RULE: Delete cache on write to prevent race conditions
     */
    it('should update user property and invalidate cache', async () => {
      const mockUser = {
        userId: 'test-user-id',
        email: 'test@example.com',
        plan: 'premium',
        lengthOfDocs: { premium: { max: 5, min: 0, current: 5 } },
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
        'premium',
      );

      expect(result).toBe(true);
      expect(User.findOneAndUpdate).toHaveBeenCalledWith(
        { userId: 'test-user-id' },
        { $set: { plan: 'premium', updatedAt: expect.any(Date) } },
        expect.any(Object),
      );

      // Should invalidate cache
      expect(cacheService.delete).toHaveBeenCalledWith('user:test-user-id');
      expect(cacheService.invalidateTag).toHaveBeenCalledWith(
        'tag:user:test-user-id',
      );
    });

    it('should decrement property correctly', async () => {
      const mockUser = {
        userId: 'test-user-id',
        email: 'test@example.com',
        plan: 'free',
        lengthOfDocs: { free: { max: 2, min: 0, current: 1 } },
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
        undefined,
      );

      expect(result).toBe(true);
      expect(User.findOneAndUpdate).toHaveBeenCalledWith(
        { userId: 'test-user-id' },
        {
          $inc: { 'lengthOfDocs.free.current': -1 },
          $set: { updatedAt: expect.any(Date) },
        },
        expect.any(Object),
      );
    });

    it('should return false when user not found', async () => {
      (User.findOneAndUpdate as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      const result = await userService.updateUser(
        'non-existent',
        'plan',
        false,
        'premium',
      );

      expect(result).toBe(false);
      expect(cacheService.delete).not.toHaveBeenCalled();
    });

    it('should update nested properties correctly', async () => {
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
        { userId: 'test-user-id' },
        expect.objectContaining({
          $set: expect.objectContaining({
            lengthOfDocs: { standard: { max: 3, min: 0, current: 3 } },
          }),
        }),
        expect.any(Object),
      );
    });

    it('should handle cache invalidation failure gracefully', async () => {
      const mockUser = {
        userId: 'test-user-id',
        email: 'test@example.com',
        plan: 'premium',
      };

      (User.findOneAndUpdate as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockUser),
      });

      // Cache invalidation fails
      (cacheService.delete as jest.Mock).mockResolvedValue(false);
      (cacheService.invalidateTag as jest.Mock).mockResolvedValue(false);

      // Should still return true (DB update succeeded)
      const result = await userService.updateUser(
        'test-user-id',
        'plan',
        false,
        'premium',
      );

      expect(result).toBe(true);
    });
  });

  // ==========================================================================
  // DELETE USER - User Deletion & Cleanup
  // ==========================================================================
  describe('deleteUser - User Deletion', () => {
    /**
     * BUSINESS RULE: Delete user and return email for archiving
     * CACHING RULE: Invalidate all user-related caches
     */
    it('should delete user and return email for archiving', async () => {
      const mockUser = {
        userId: 'test-user-id',
        email: 'test@example.com',
      };

      (User.findOne as jest.Mock).mockResolvedValue(mockUser);
      (User.deleteOne as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue({ deletedCount: 1 }),
      });

      (cacheService.delete as jest.Mock).mockResolvedValue(true);
      (cacheService.invalidateTag as jest.Mock).mockResolvedValue(true);

      const result = await userService.deleteUser('test-user-id');

      expect(result).toBe('test@example.com');
      expect(User.deleteOne).toHaveBeenCalledWith({ userId: 'test-user-id' });
    });

    it('should return null when user not found', async () => {
      (User.findOne as jest.Mock).mockResolvedValue(null);

      const result = await userService.deleteUser('non-existent');

      expect(result).toBeNull();
      expect(User.deleteOne).not.toHaveBeenCalled();
      expect(cacheService.delete).not.toHaveBeenCalled();
    });

    it('should invalidate cache and tags on successful deletion', async () => {
      const mockUser = {
        userId: 'test-user-id',
        email: 'test@example.com',
      };

      (User.findOne as jest.Mock).mockResolvedValue(mockUser);
      (User.deleteOne as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue({ deletedCount: 1 }),
      });

      (cacheService.delete as jest.Mock).mockResolvedValue(true);
      (cacheService.invalidateTag as jest.Mock).mockResolvedValue(true);

      await userService.deleteUser('test-user-id');

      expect(cacheService.delete).toHaveBeenCalledWith('user:test-user-id');
      expect(cacheService.invalidateTag).toHaveBeenCalledWith(
        'tag:user:test-user-id',
      );
    });

    it('should handle case where user found but deletion returns 0', async () => {
      const mockUser = {
        userId: 'test-user-id',
        email: 'test@example.com',
      };

      (User.findOne as jest.Mock).mockResolvedValue(mockUser);
      (User.deleteOne as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue({ deletedCount: 0 }),
      });

      const result = await userService.deleteUser('test-user-id');

      expect(result).toBeNull();
    });
  });

  // ==========================================================================
  // ARCHIVE USER - User Archiving for Re-registration Prevention
  // ==========================================================================
  describe('archiveUser - User Archiving', () => {
    /**
     * BUSINESS RULE: Archive deleted users to prevent same-month re-registration
     */
    it('should archive user email with deletion timestamp', async () => {
      (DeletedUsers.create as jest.Mock).mockResolvedValue({
        email: 'test@example.com',
        deletedAt: expect.any(Date),
      });

      await userService.archiveUser('test@example.com');

      expect(DeletedUsers.create).toHaveBeenCalledWith({
        email: 'test@example.com',
        deletedAt: expect.any(Date),
      });
    });

    it('should not throw error when archiving fails', async () => {
      (DeletedUsers.create as jest.Mock).mockRejectedValue(
        new Error('DB Error'),
      );

      // Should not throw (fail silently)
      await expect(
        userService.archiveUser('test@example.com'),
      ).resolves.not.toThrow();
    });
  });
});
