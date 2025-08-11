/**
 * @copyright 2025 Adeniyi Bella
 * @license Apache-2.0
 */

/**
 * Node modules
 */
import { container } from 'tsyringe';

/**
 * Custom modules
 */
import { logger } from '@/lib/winston';
import { IUserService } from '@/services/users/user.interface';

/**
 * Types
 */
import type { NextFunction, Request, Response } from 'express';
import { ApiResponse } from '@/lib/api_response';

const createUser = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  const userService = container.resolve<IUserService>('IUserService');

  try {
    let user = await userService.checkIfUserExist(req);

    logger.info('check if user exists', user);

    if (!user) {
      await userService.createUserFromToken(req);
    }

    return next();
  } catch (error: unknown) {
      logger.error('Error deleting document', error);
      // Check if error is an instance of Error to safely access message
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      ApiResponse.serverError(res, 'Internal server error', errorMessage);
    }
};

export default createUser;
