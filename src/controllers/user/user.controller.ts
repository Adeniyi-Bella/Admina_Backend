import { container } from 'tsyringe';
import { Request, Response, NextFunction } from 'express';
import { asyncHandler } from '@/middlewares/errorHandler';
import { IUserService } from '@/services/users/user.interface';
import { PlanChangeError, UserNotFoundError } from '@/lib/api_response/error';
import { IPlans } from '@/types';
import { logger } from '@/lib/winston';
import { ApiResponse } from '@/lib/api_response';
import { PlanType } from '@/models/user.model';

import { planHierarchy } from '@/utils/user.utils';

export const createUser = asyncHandler(
  async (req: Request, _, next: NextFunction): Promise<void> => {
    const userService = container.resolve<IUserService>('IUserService');

    const user = await userService.checkIfUserExist(req);

    if (!user) {
      await userService.createUserFromToken(req);
    }

    logger.info('user validation successful', {
      userId: user?.userId,
      userEmail: user?.email,
    });

    return next();
  },
);
/**
 * DELETE USER
 */
export const deleteUser = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const userService = container.resolve<IUserService>('IUserService');

    const user = await userService.checkIfUserExist(req);
    if (!user) {
      throw new UserNotFoundError();
    }

    await userService.deleteUser(req.userId);

    const deletedFromEntraId = await userService.deleteUserFromEntraId(
      req.userId,
    );
    if (!deletedFromEntraId) {
      logger.warn(
        'Something unexpected and unknown happened during user deletion from Entra ID',
        {
          userId: req.userId,
        },
      );
    }

    ApiResponse.noContent(res);
  },
);

export const getUserDetails = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const userService = container.resolve<IUserService>('IUserService');

    const user = await userService.checkIfUserExist(req);
    if (!user) {
      throw new UserNotFoundError();
    }

    const plan = user.plan as keyof IPlans;

    console.log(plan);
    const documentLimits = user.lengthOfDocs[plan];

    ApiResponse.ok(res, 'User details fetched successfully', {
      planName: user.plan,
      email: user.email,
      documentLimits,
    });
  },
);

/**
 * UPGRADE DOWNGRADE USER PLAN
 */
export const changeUserPlan = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const userService = container.resolve<IUserService>('IUserService');
    const targetPlan = req.params.plan as PlanType;

    const user = await userService.checkIfUserExist(req);
    if (!user) throw new UserNotFoundError();

    const currentRank = planHierarchy[user.plan as PlanType];
    const targetRank = planHierarchy[targetPlan];

    if (currentRank === targetRank) {
      throw new PlanChangeError(`User is already on the ${targetPlan} plan`);
    }

    await userService.changeUserPlan(req.userId, targetPlan);

    ApiResponse.ok(res, `Plan successfully changed to ${targetPlan}`);
  },
);
