/**
 * @copyright 2025 Adeniyi Bella
 * @license Apache-2.0
 */

import { container } from 'tsyringe';
import { logger } from '@/lib/winston';
import { IUserService } from '@/services/users/user.interface';
import { IDocumentService } from '@/services/document/document.interface';
import { ApiResponse } from '@/lib/api_response';
import { IPlans } from '@/types';
import type { Request, Response } from 'express';

const upgradeUserPlan = async (req: Request, res: Response): Promise<void> => {
  const userService = container.resolve<IUserService>('IUserService');
  const docService = container.resolve<IDocumentService>('IDocumentService');

  try {
    // Get current user
    const user = await userService.checkIfUserExist(req);
    if (!user) {
      logger.error('User not found during upgradeUserPlan');
      ApiResponse.notFound(res, 'User not found');
      return;
    }

    const currentPlan = user.plan;
    const planToUpgradeTo = req.params.plan;

    // Validate requested upgrade plan
    const allowedPlans = ['standard', 'premium'];
    if (!allowedPlans.includes(planToUpgradeTo)) {
      logger.error(`Invalid target plan: ${planToUpgradeTo}`);
      ApiResponse.badRequest(
        res,
        `Invalid target plan: ${planToUpgradeTo}. Must be "standard" or "premium".`
      );
      return;
    }

    // Enforce upgrade rules based on current plan
    switch (currentPlan) {
      case 'free':
        // can upgrade to standard or premium
        break;
      case 'standard':
        if (planToUpgradeTo !== 'premium') {
          logger.error('Standard plan can only be upgraded to premium');
          ApiResponse.badRequest(
            res,
            'Standard plan can only be upgraded to premium'
          );
          return;
        }
        break;
      case 'premium':
        logger.error('Premium plan cannot be upgraded further');
        ApiResponse.badRequest(res, 'Premium plan cannot be upgraded further');
        return;
      default:
        logger.error(`Unknown current plan: ${currentPlan}`);
        ApiResponse.badRequest(res, `Unknown current plan: ${currentPlan}`);
        return;
    }

    // Update user plan
    await userService.updateUser(req.userId, 'plan', false, planToUpgradeTo);

    // Set lengthOfDocs for new plan
    const newLengthOfDocs: IPlans =
      planToUpgradeTo === 'standard'
        ? { standard: { max: 3, min: 0, current: 3 } }
        : { premium: { max: 5, min: 0, current: 5 } };

    await userService.updateUser(req.userId, 'lengthOfDocs', false, newLengthOfDocs);

     // Update documents' chatBotPrompt
    const maxDocsForPrevPlan =
      currentPlan === 'free'
        ? user.lengthOfDocs.free!.max
        : user.lengthOfDocs.standard!.max;
        
    // Update documents' chatBotPrompt for new plan
    const { documents } = await docService.getAllDocumentsByUserId(
      req.userId,
      maxDocsForPrevPlan,
      0
    );

    const newChatBotPrompt: IPlans =
      planToUpgradeTo === 'standard'
        ? { standard: { max: 5, min: 0, current: 5 } }
        : { premium: { max: 10, min: 0, current: 10 } };

    for (const doc of documents) {
      await docService.updateDocument(req.userId, doc.docId, {
        chatBotPrompt: newChatBotPrompt,
      });
    }

    logger.info(
      `User upgraded successfully from ${currentPlan} to ${planToUpgradeTo} and document chatBotPrompt updated`,
      { user }
    );
    ApiResponse.ok(res, 'User upgraded successfully');
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    ApiResponse.serverError(res, 'Internal server error', errorMessage);
    logger.error('Error upgrading user', errorMessage);
  }
};

export default upgradeUserPlan;
