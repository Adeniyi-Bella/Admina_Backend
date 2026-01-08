import { ApiResponse } from '@/lib/api_response';
import { logger } from '@/lib/winston';
import { IUserService } from '@/services/users/user.interface';
import { IPlans } from '@/types';
import type { Request, Response } from 'express';
import { container } from 'tsyringe';

const getUserDetails = async (req: Request, res: Response): Promise<void> => {
  const userService = container.resolve<IUserService>('IUserService');

  try {
    // Retrieve user plan
    const user = await userService.checkIfUserExist(req);
    if (!user) {
      ApiResponse.notFound(res, 'User not found');
      return;
    }

    const plan = user.plan as keyof IPlans; 
    const documentLimits = user.lengthOfDocs[plan];

    ApiResponse.ok(res, 'User Details fetched successfully', {
      planName: user.plan,
      documentLimits
    });
  } catch (error: unknown) {
    logger.error('Error fetching document', error);
    // Check if error is an instance of Error to safely access message
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    ApiResponse.serverError(res, 'Internal server error', errorMessage);
  }
};

export default getUserDetails;
