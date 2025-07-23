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

const createUser = async (req: Request, res: Response, next: NextFunction,): Promise<void> => {
  const userService = container.resolve<IUserService>('IUserService');

  try {

    let user = await userService.checkIfUserExist(req);

    logger.info("check if user exists", user)

    if (!user){
     user  = await userService.createUserFromToken(req);
    }

    return next();
  } catch (err) {
    res.status(500).json({
      code: 'ServerError',
      message: 'Internal server error',
      error: err,
    });

    logger.error('Error during user registration', err);
  }
};

export default createUser;
