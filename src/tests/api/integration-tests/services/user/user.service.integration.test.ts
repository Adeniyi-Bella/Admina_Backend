/**
 * @copyright 2025 Adeniyi Bella
 * @license Apache-2.0
 */

/**
 * Npm modules
 */
import 'reflect-metadata';
import { Request } from 'express';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { container } from 'tsyringe';

/**
 * Services and Interfaces
 */
import { IUserService } from '@/services/users/user.interface';
import { UserService } from '@/services/users/user.service';

/**
 * Models
 */
import User from '@/models/user';
import { checkInterfaceCoverage } from '@/tests/api/utils';

// Register UserService for DI
container.register<IUserService>('IUserService', { useClass: UserService });

describe('UserService Integration Tests', () => {
  let mongoServer: MongoMemoryServer;
  let userService: IUserService;

  // // Meta-test for interface coverage
  // describe('IUserService Interface Coverage', () => {
  //   it('should have tests for all IUserService methods in this file', () => {
  //     checkInterfaceCoverage(
  //       'src/services/users/user.interface.ts',
  //       'IUserService',
  //       __filename,
  //     );
  //   });
  // });

  beforeAll(async () => {
    // Start in-memory MongoDB
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    await mongoose.connect(uri);

    // Resolve UserService from container
    userService = container.resolve<IUserService>('IUserService');
  });

  afterEach(async () => {
    // Clear database after each test
    await User.deleteMany({});
  });

  afterAll(async () => {
    // Clean up
    await mongoose.disconnect();
    await mongoServer.stop();
  });
  describe('checkIfUserExist', () => {
    it('should return null if user does not exist', async () => {
      const mockRequest = {
        userId: 'nonexistent',
      } as Request;

      const result = await userService.checkIfUserExist(mockRequest);

      expect(result).toBeNull();
    });

    it('should return user if user exists', async () => {
      const userData = {
        userId: '12345',
        email: 'test@example.com',
        username: 'testUser',
        plan: 'free',
      };
      await User.create(userData);

      const mockRequest = {
        userId: userData.userId,
      } as Request;

      const result = await userService.checkIfUserExist(mockRequest);

      expect(result).toEqual({
        userId: userData.userId,
        plan: userData.plan,
      });
    });
  });

  describe('createUserFromToken', () => {
    it('should create a new user from token', async () => {
      const mockRequest = {
        userId: '67890',
        email: 'newuser@example.com',
        username: 'newUser',
      } as Request;

      const result = await userService.createUserFromToken(mockRequest);

      expect(result).toEqual({
        userId: mockRequest.userId,
        plan: 'free',
      });

      // Verify user was saved in the database
      const savedUser = await User.findOne({ userId: mockRequest.userId });
      expect(savedUser).toBeDefined();
      expect(savedUser?.email).toBe(mockRequest.email);
      expect(savedUser?.username).toBe(mockRequest.username);
    });
  });

  describe('updateUser', () => {
    it('should increment a property by 1 and return true', async () => {
      const userId = '123';
      await User.create({
        userId,
        email: 'test@example.com',
        username: 'testUser',
        lenghtOfDocs: 5,
        plan: 'free',
      });

      const result = await userService.updateUser(userId, 'lenghtOfDocs', true, undefined);

      expect(result).toBe(true);

      // Verify database state
      const updatedUser = await User.findOne({ userId });
      expect(updatedUser).toBeDefined();
      expect(updatedUser?.lenghtOfDocs).toBe(6);
      expect(updatedUser?.updatedAt).toBeInstanceOf(Date);
    });

    it('should set a property to a specified value and return true', async () => {
      const userId = '123';
      await User.create({
        userId,
        email: 'test@example.com',
        username: 'testUser',
        plan: 'free',
      });

      const result = await userService.updateUser(
        userId,
        'plan',
        false,
        'premium',
      );

      expect(result).toBe(true);

      // Verify database state
      const updatedUser = await User.findOne({ userId });
      expect(updatedUser).toBeDefined();
      expect(updatedUser?.plan).toBe('premium');
      expect(updatedUser?.updatedAt).toBeInstanceOf(Date);
    });
  });
 
});
