/**
 * @copyright 2025 Adeniyi Bella
 * @license Apache-2.0
 */

/**
 * Types
 */
import type { Request } from 'express';

export interface UserDTO {
  userId: string;
  plan: string;
}

export interface IUserService {
  checkIfUserExist(req: Request): Promise<UserDTO | null>;
  createUserFromToken(req: Request): Promise<UserDTO>;
  updateUser(userId: string, property: string, increment: boolean, value: string | undefined): Promise<boolean>;
}
