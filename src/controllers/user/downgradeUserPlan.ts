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
import type { Request, Response } from 'express';

const downgradeUserPlan = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const userService = container.resolve<IUserService>('IUserService');

  try {
    // Retrieve user plan
    const user = await userService.checkIfUserExist(req);
    if (!user || user.plan !== 'premium') {
      logger.error('User or User should have a premium plan');
      res.status(400).json({
        code: 'NotFound',
        message: 'User details not correct',
      });
      return;

    }

    await userService.updateUser(req.userId, 'plan', false, 'free');
    await userService.updateUser(req.userId, 'prompt', false, 0);

    res.status(200).json({ message: 'ok' });

  } catch (err) {
    res.status(500).json({
      code: 'ServerError',
      message: 'Internal server error',
      error: err,
    });

    logger.error('Error during user registration', err);
  }
};

export default downgradeUserPlan;
