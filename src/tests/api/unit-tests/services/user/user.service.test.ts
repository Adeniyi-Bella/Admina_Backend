/**
 * @copyright 2025 Adeniyi Bella
 * @license Apache-2.0
 */

/**
 * Npm modules
 */
import "reflect-metadata"
import { container } from 'tsyringe';

/**
 * Services
 */
import { UserService } from '@/services/users/user.service';

/**
 * Models
 */
import User from '@/models/user';

/**
 * Types
 */
import type { Request } from 'express';

// Mock the User model
jest.mock('@/models/user');

describe('UserService', () => {
  let userService: UserService;

  beforeEach(() => {
    // Mock logger to avoid DI errors
    container.register('logger', { useValue: { info: jest.fn(), error: jest.fn() } });
    // Resolve UserService from tsyringe container
    userService = container.resolve(UserService);
    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  afterEach(() => {
    // Reset tsyringe container to avoid state leakage
    container.reset();
  });

  describe('checkIfUserExist', () => {
    it('should return UserDTO if user exists', async () => {
      const req = { userId: '123' } as Request;
      const mockUser = { userId: '123', email: 'test@example.com', username: 'testuser' };
      (User.findOne as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(mockUser),
      });

      const result = await userService.checkIfUserExist(req);

      expect(result).toEqual({ userId: '123' });
      expect(User.findOne).toHaveBeenCalledWith({ userId: '123' });
      expect(User.findOne().select).toHaveBeenCalledWith('-__v');
      expect(User.findOne().exec).toHaveBeenCalled();
    });

    it('should return null if user does not exist', async () => {
      const req = { userId: '123' } as Request;
      (User.findOne as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(null),
      });
      

      const result = await userService.checkIfUserExist(req);

      expect(result).toBeNull();
      expect(User.findOne).toHaveBeenCalledWith({ userId: '123' });
      expect(User.findOne().select).toHaveBeenCalledWith('-__v');
      expect(User.findOne().exec).toHaveBeenCalled();
    });

    it('should throw an error on database failure', async () => {
      const req = { userId: '123' } as Request;
      const error = new Error('Database error');
      (User.findOne as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnThis(),
        exec: jest.fn().mockRejectedValue(error),
      });

      await expect(userService.checkIfUserExist(req)).rejects.toThrow('Database error');
      expect(User.findOne).toHaveBeenCalledWith({ userId: '123' });
      expect(User.findOne().select).toHaveBeenCalledWith('-__v');
      expect(User.findOne().exec).toHaveBeenCalled();
    });
  });

  describe('createUserFromToken', () => {
    it('should create and return a new user', async () => {
      const req = { userId: '123', email: 'test@example.com', username: 'testuser' } as Request;
      const mockUser = { userId: '123', email: 'test@example.com', username: 'testuser' };
      (User.create as jest.Mock).mockResolvedValue(mockUser);

      const result = await userService.createUserFromToken(req);

      expect(result).toEqual({ userId: '123' });
      expect(User.create).toHaveBeenCalledWith({
        userId: '123',
        email: 'test@example.com',
        username: 'testuser',
      });
    });

    it('should throw an error on creation failure', async () => {
      const req = { userId: '123', email: 'test@example.com', username: 'testuser' } as Request;
      const error = new Error('Creation error');
      (User.create as jest.Mock).mockRejectedValue(error);

      await expect(userService.createUserFromToken(req)).rejects.toThrow('Creation error');
      expect(User.create).toHaveBeenCalledWith({
        userId: '123',
        email: 'test@example.com',
        username: 'testuser',
      });
    });
  });
});