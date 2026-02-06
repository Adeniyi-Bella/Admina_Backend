/**
 * @copyright 2025 Adeniyi Bella
 * @license Apache-2.0
 */

/**
 * Types
 */
import { PlanType } from '@/models/user.model';
import { UserDTO } from '@/types';
import type { Request } from 'express';

export interface IUserService {
  checkIfUserExist(req: Request): Promise<UserDTO | null>;
  createUserFromToken(req: Request): Promise<UserDTO>;
  updateUser(userId: string, plan: PlanType): Promise<void>;
  deleteUser(userId: string): Promise<void>;
  deleteUserFromEntraId(userId: string): Promise<boolean>;
  changeUserPlan(userId: string, targetPlan: PlanType): Promise<void>;
}
// export { UserDTO };
