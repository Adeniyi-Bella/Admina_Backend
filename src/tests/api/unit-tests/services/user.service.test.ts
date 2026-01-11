import "reflect-metadata"
import { UserService } from '@/services/users/user.service';
import User from '@/models/user.model';
import DeletedUsers from '@/models/deletedUsers.model';
import redis from '@/lib/redis';
import { Request } from 'express';
import { ConfidentialClientApplication } from '@azure/msal-node';
import { Client } from '@microsoft/microsoft-graph-client';

jest.mock('@/models/user.model');
jest.mock('@/models/deletedUsers.model');
jest.mock('@/lib/redis');
jest.mock('@azure/msal-node');
jest.mock('@microsoft/microsoft-graph-client');

describe('UserService - Critical Business Logic', () => {
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
        userService.checkUserEligibility(mockRequest as Request)
      ).rejects.toThrow(
        'You cannot re-register in the same month you deleted your account.'
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
        userService.checkUserEligibility(mockRequest as Request)
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
        userService.checkUserEligibility(mockRequest as Request)
      ).resolves.not.toThrow();

      jest.useRealTimers();
    });
  });

  describe('updateUser - Property Updates with Cache Invalidation', () => {
    /**
     * CRITICAL: Updates must invalidate cache to prevent stale data
     */
    it('should update property and refresh cache', async () => {
      const mockUser = {
        userId: 'test-user-id',
        email: 'test@example.com',
        plan: 'premium',
        lengthOfDocs: { premium: { max: 5, min: 0, current: 5 } },
      };

      (User.findOneAndUpdate as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockUser),
      });

      (redis.set as jest.Mock).mockResolvedValue('OK');

      const result = await userService.updateUser(
        'test-user-id',
        'plan',
        false,
        'premium'
      );

      expect(result).toBe(true);
      expect(redis.set).toHaveBeenCalledWith(
        'user:test-user-id',
        expect.any(String),
        'EX',
        3600
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

      const result = await userService.updateUser(
        'test-user-id',
        'lengthOfDocs.free.current',
        true,
        undefined
      );

      expect(result).toBe(true);
      expect(User.findOneAndUpdate).toHaveBeenCalledWith(
        { userId: 'test-user-id' },
        expect.objectContaining({
          $inc: { 'lengthOfDocs.free.current': -1 },
        }),
        expect.any(Object)
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
        'premium'
      );

      expect(result).toBe(false);
      expect(redis.set).not.toHaveBeenCalled();
    });
  });

  describe('checkIfUserExist - Cache Strategy', () => {
    /**
     * CRITICAL: Cache-first strategy with proper fallback
     */
    it('should return cached user when available', async () => {
      const cachedUser = {
        userId: 'test-user-id',
        email: 'test@example.com',
        plan: 'free',
        lengthOfDocs: { free: { max: 2, min: 0, current: 2 } },
      };

      (redis.get as jest.Mock).mockResolvedValue(JSON.stringify(cachedUser));

      const result = await userService.checkIfUserExist(mockRequest as Request);

      expect(result).toEqual(cachedUser);
      expect(User.findOne).not.toHaveBeenCalled();
    });

    it('should fetch from DB and cache when not in Redis', async () => {
      const dbUser = {
        userId: 'test-user-id',
        email: 'test@example.com',
        plan: 'free',
        lengthOfDocs: { free: { max: 2, min: 0, current: 2 } },
      };

      (redis.get as jest.Mock).mockResolvedValue(null);
      (User.findOne as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(dbUser),
      });
      (redis.set as jest.Mock).mockResolvedValue('OK');

      const result = await userService.checkIfUserExist(mockRequest as Request);

      expect(result).toEqual(dbUser);
      expect(User.findOne).toHaveBeenCalledWith({ userId: 'test-user-id' });
      expect(redis.set).toHaveBeenCalled();
    });
  });

  describe('deleteUser - Cache Invalidation', () => {
    /**
     * CRITICAL: Must clear cache when deleting user
     */
    it('should delete user and invalidate cache', async () => {
      const mockUser = {
        userId: 'test-user-id',
        email: 'test@example.com',
      };

      (User.findOne as jest.Mock).mockResolvedValue(mockUser);
      (User.deleteOne as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue({ deletedCount: 1 }),
      });
      (redis.del as jest.Mock).mockResolvedValue(1);

      const result = await userService.deleteUser('test-user-id');

      expect(result).toBe('test@example.com');
      expect(redis.del).toHaveBeenCalledWith('user:test-user-id');
    });

    it('should return null when user not found', async () => {
      (User.findOne as jest.Mock).mockResolvedValue(null);

      const result = await userService.deleteUser('non-existent');

      expect(result).toBeNull();
      expect(redis.del).not.toHaveBeenCalled();
    });
  });

  describe('deleteUserFromEntraId - External API Integration', () => {
    it('should handle 404 gracefully (user already deleted)', async () => {
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

    it('should throw error for non-404 failures', async () => {
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
  });
});