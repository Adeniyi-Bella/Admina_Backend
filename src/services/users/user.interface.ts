/**
 * @copyright 2025 Adeniyi Bella
 * @license Apache-2.0
 */

/**
 * Types
 */
import { IPlans } from '@/types';
import type { Request } from 'express';

export interface UserDTO {
  userId: string;
  plan: string;
  lengthOfDocs: IPlans
}

export interface IUserService {
  checkIfUserExist(req: Request): Promise<UserDTO | null>;
  createUserFromToken(req: Request): Promise<void>;
  updateUser(
    userId: string,
    property: string,
    increment: boolean,
    value: string | undefined | number | {},
  ): Promise<boolean>;
  deleteUser(userId: string): Promise<boolean>;
  deleteUserFromEntraId(userId: string): Promise<boolean>;
}
