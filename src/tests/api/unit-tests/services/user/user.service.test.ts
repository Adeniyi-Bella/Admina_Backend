// /**
//  * @copyright 2025 Adeniyi Bella
//  * @license Apache-2.0
//  */

// /**
//  * Npm modules
//  */
// import 'reflect-metadata';
// import { container } from 'tsyringe';

// /**
//  * Services
//  */
// import { UserService } from '@/services/users/user.service';

// /**
//  * Interfaces
//  */
// import { IUserService } from '@/services/users/user.interface';

// /**
//  * Models
//  */
// import User from '@/models/user';

// /**
//  * Types
//  */
// import type { Request } from 'express';

// /**
//  * Custom modules
//  */
// import { checkInterfaceCoverage } from '@/tests/api/utils';

// // Mock the User model
// jest.mock('@/models/user');

// describe('UserService', () => {
//   let userService: UserService;
//   let updateOneExecMock: jest.Mock;

//   // Meta-test for interface coverage
//   describe('IUserService Interface Coverage', () => {
//     it('should have tests for all IUserService methods in this file', () => {
//       checkInterfaceCoverage(
//         'src/services/users/user.interface.ts',
//         'IUserService',
//         __filename,
//       );
//     });
//   });

//   beforeAll(() => {
//     // Register UserService for DI
//     container.register<IUserService>('IUserService', { useClass: UserService });
//     userService = container.resolve<IUserService>('IUserService');
//   });

//   beforeEach(() => {
//     // Clear all mocks before each test
//     jest.clearAllMocks();
//     // Initialize the exec mock
//     updateOneExecMock = jest.fn().mockResolvedValue({ modifiedCount: 1 });
//     (User.updateOne as jest.Mock).mockReturnValue({
//       exec: updateOneExecMock,
//     });
//   });

//   afterEach(() => {
//     // Reset tsyringe container to avoid state leakage
//     container.reset();
//   });

//   describe('checkIfUserExist', () => {
//     it('should return UserDTO if user exists', async () => {
//       const req = { userId: '123' } as Request;
//       const mockUser = {
//         userId: '123',
//         email: 'test@example.com',
//         username: 'testuser',
//       };
//       (User.findOne as jest.Mock).mockReturnValue({
//         select: jest.fn().mockReturnThis(),
//         exec: jest.fn().mockResolvedValue(mockUser),
//       });

//       const result = await userService.checkIfUserExist(req);

//       expect(result).toEqual({ userId: '123' });
//       expect(User.findOne).toHaveBeenCalledWith({ userId: '123' });
//       expect(User.findOne().select).toHaveBeenCalledWith('-__v');
//       expect(User.findOne().exec).toHaveBeenCalled();
//     });

//     it('should return null if user does not exist', async () => {
//       const req = { userId: '123' } as Request;
//       (User.findOne as jest.Mock).mockReturnValue({
//         select: jest.fn().mockReturnThis(),
//         exec: jest.fn().mockResolvedValue(null),
//       });

//       const result = await userService.checkIfUserExist(req);

//       expect(result).toBeNull();
//       expect(User.findOne).toHaveBeenCalledWith({ userId: '123' });
//       expect(User.findOne().select).toHaveBeenCalledWith('-__v');
//       expect(User.findOne().exec).toHaveBeenCalled();
//     });

//     it('should throw an error on database failure', async () => {
//       const req = { userId: '123' } as Request;
//       const error = new Error('Database error');
//       (User.findOne as jest.Mock).mockReturnValue({
//         select: jest.fn().mockReturnThis(),
//         exec: jest.fn().mockRejectedValue(error),
//       });

//       await expect(userService.checkIfUserExist(req)).rejects.toThrow(
//         'Database error',
//       );
//       expect(User.findOne).toHaveBeenCalledWith({ userId: '123' });
//       expect(User.findOne().select).toHaveBeenCalledWith('-__v');
//       expect(User.findOne().exec).toHaveBeenCalled();
//     });
//   });

//   describe('createUserFromToken', () => {
//     it('should create and return a new user', async () => {
//       const req = {
//         userId: '123',
//         email: 'test@example.com',
//         username: 'testuser',
//       } as Request;
//       const mockUser = {
//         userId: '123',
//         email: 'test@example.com',
//         username: 'testuser',
//       };
//       (User.create as jest.Mock).mockResolvedValue(mockUser);

//       const result = await userService.createUserFromToken(req);

//       expect(result).toEqual({ userId: '123' });
//       expect(User.create).toHaveBeenCalledWith({
//         userId: '123',
//         email: 'test@example.com',
//         username: 'testuser',
//       });
//     });

//     it('should throw an error on creation failure', async () => {
//       const req = {
//         userId: '123',
//         email: 'test@example.com',
//         username: 'testuser',
//       } as Request;
//       const error = new Error('Creation error');
//       (User.create as jest.Mock).mockRejectedValue(error);

//       await expect(userService.createUserFromToken(req)).rejects.toThrow(
//         'Creation error',
//       );
//       expect(User.create).toHaveBeenCalledWith({
//         userId: '123',
//         email: 'test@example.com',
//         username: 'testuser',
//       });
//     });
//   });

//   describe('updateUser', () => {
//     it('should increment a property by 1 and return true', async () => {
//       const userId = '123';

//       const result = await userService.updateUser(userId, 'lenghtOfDocs', true, undefined);

//       expect(result).toBe(true);
//       expect(User.updateOne).toHaveBeenCalledWith(
//         { userId },
//         {
//           $inc: { lenghtOfDocs: 1 },
//           $set: { updatedAt: expect.any(Date) },
//         },
//       );
//       expect(updateOneExecMock).toHaveBeenCalled();
//     });

//     it('should set a property to a specified value and return true', async () => {
//       const userId = '123';
//       (User.updateOne as jest.Mock).mockReturnValue({
//         exec: updateOneExecMock,
//       });

//       const result = await userService.updateUser(userId, 'plan', false, 'premium');

//       expect(result).toBe(true);
//       expect(User.updateOne).toHaveBeenCalledWith(
//         { userId },
//         {
//           $set: { plan: 'premium', updatedAt: expect.any(Date) },
//         },
//       );
//       expect(updateOneExecMock).toHaveBeenCalled();
//     });

//     // it('should throw an error if the user is not found or property is not updated', async () => {
//     //   const userId = '123';
//     //   (User.updateOne as jest.Mock).mockReturnValue({
//     //     exec: jest.fn().mockResolvedValue({ modifiedCount: 0 }),
//     //   });

//     //   await expect(userService.updateUser(userId, 'lenghtOfDocs', true)).rejects.toThrow('Failed to update user property');
//     //   expect(User.updateOne).toHaveBeenCalledWith(
//     //     { userId },
//     //     {
//     //       $inc: { lenghtOfDocs: 1 },
//     //       $set: { updatedAt: expect.any(Date) },
//     //     },
//     //   );
//     //   expect(updateOneExecMock).toHaveBeenCalled();
//     // });

//     // it('should throw an error if value is missing for non-increment update', async () => {
//     //   const userId = '123';

//     //   await expect(userService.updateUser(userId, 'plan')).rejects.toThrow('Failed to update user property');
//     // });

//     // it('should throw an error on database failure', async () => {
//     //   const userId = '123';
//     //   const error = new Error('Database error');
//     //   (User.updateOne as jest.Mock).mockReturnValue({
//     //     exec: jest.fn().mockRejectedValue(error),
//     //   });

//     //   await expect(userService.updateUser(userId, 'lenghtOfDocs', true)).rejects.toThrow('Failed to update user property');
//     //   expect(User.updateOne).toHaveBeenCalledWith(
//     //     { userId },
//     //     {
//     //       $inc: { lenghtOfDocs: 1 },
//     //       $set: { updatedAt: expect.any(Date) },
//     //     },
//     //   );
//     //   expect(updateOneExecMock).toHaveBeenCalled();
//     // });
//   });
// });