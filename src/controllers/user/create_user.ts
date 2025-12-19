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
    await userService.checkUserEligibility(req);
    let user = await userService.checkIfUserExist(req);

    if (!user) {
      await userService.createUserFromToken(req);
    }

    return next();
  } catch (error: unknown) {

    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';

    if (errorMessage.includes('You cannot re-register')) {
      logger.warn('Deleted user trying to re-register:', errorMessage);
      ApiResponse.forbidden(res, errorMessage);
      return;
    }

    logger.error('Error creating user', error);

    ApiResponse.serverError(res, 'Internal server error', errorMessage);
  }
};

export default createUser;
