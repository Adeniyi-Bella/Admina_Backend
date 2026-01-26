import { container } from 'tsyringe';
import { Request, Response, NextFunction } from 'express';
import { asyncHandler } from '@/middlewares/errorHandler';
import { IUserService } from '@/services/users/user.interface';
import { IDocumentService } from '@/services/document/document.interface';
import {
  PlanDowngradeError,
  PlanUpgradeError,
  UserNotFoundError,
} from '@/lib/api_response/error';
import { IPlans } from '@/types';
import { logger } from '@/lib/winston';
import { ApiResponse } from '@/lib/api_response';
import { IChatBotService } from '@/services/chatbot/chatbot.interface';
import { PlanLimits, PlanType } from '@/models/user.model';
import { ChatbotPlanLimits } from '@/models/document.model';

export const createUser = asyncHandler(
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const userService = container.resolve<IUserService>('IUserService');

    let user = await userService.checkIfUserExist(req);

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
 * UPGRADE USER PLAN CONTROLLER
 */
export const upgradeUserPlan = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const userService = container.resolve<IUserService>('IUserService');
    const docService = container.resolve<IDocumentService>('IDocumentService');

    const user = await userService.checkIfUserExist(req);
    if (!user) {
      throw new UserNotFoundError();
    }

    const currentPlan = user.plan;
    const planToUpgradeTo = req.params.plan as PlanType;
    const allowedPlans = ['standard', 'premium'];

    if (!allowedPlans.includes(planToUpgradeTo)) {
      throw new PlanUpgradeError(
        `Invalid target plan: ${planToUpgradeTo}. Must be "standard" or "premium".`,
      );
    }

    switch (currentPlan) {
      case 'free':
        break;
      case 'standard':
        if (planToUpgradeTo !== 'premium') {
          throw new PlanUpgradeError(
            'Standard plan can only be upgraded to premium',
          );
        }
        break;
      case 'premium':
        throw new PlanUpgradeError('Premium plan cannot be upgraded further');
      default:
        throw new PlanUpgradeError(`Unknown current plan: ${currentPlan}`);
    }

    await userService.updateUser(req.userId, 'plan', false, planToUpgradeTo);

    // const newLengthOfDocs: IPlans =
    //   planToUpgradeTo === 'standard'
    //     ? { standard: { max: 3, min: 0, current: 3 } }
    //     : { premium: { max: 5, min: 0, current: 5 } };

    const newLengthOfDocs: IPlans = {
      [planToUpgradeTo]: PlanLimits[planToUpgradeTo],
    };

    await userService.updateUser(
      req.userId,
      'lengthOfDocs',
      false,
      newLengthOfDocs,
    );

    const maxDocsForPrevPlan =
      currentPlan === 'free'
        ? user.lengthOfDocs.free!.max
        : user.lengthOfDocs.standard!.max;

    const { documents } = await docService.getAllDocumentsByUserId(
      user,
      maxDocsForPrevPlan,
      0,
    );

    // const newChatBotPrompt: IPlans =
    //   planToUpgradeTo === 'standard'
    //     ? { standard: { max: 5, min: 0, current: 5 } }
    //     : { premium: { max: 10, min: 0, current: 10 } };

    const newChatBotPrompt: IPlans = {
      [planToUpgradeTo]: ChatbotPlanLimits[planToUpgradeTo],
    };

    for (const doc of documents) {
      await docService.updateDocument(req.userId, doc.docId, {
        chatBotPrompt: newChatBotPrompt,
      });
    }

    logger.info(
      `User upgraded successfully from ${currentPlan} to ${planToUpgradeTo}`,
      {
        user: {
          id: user.userId,
          email: user.email,
        },
      },
    );

    ApiResponse.ok(res, 'User upgraded successfully');
  },
);

/**
 * DOWNGRADE USER PLAN CONTROLLER
 */
export const downgradeUserPlan = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const userService = container.resolve<IUserService>('IUserService');
    const docService = container.resolve<IDocumentService>('IDocumentService');

    const user = await userService.checkIfUserExist(req);
    if (!user) {
      throw new UserNotFoundError();
    }

    const currentPlan = user.plan;
    const planToDowngradeTo = req.params.plan as PlanType;
    const allowedPlans = ['standard', 'free'];

    if (!allowedPlans.includes(planToDowngradeTo)) {
      throw new PlanDowngradeError(
        `Invalid target plan: ${planToDowngradeTo}. Must be "standard" or "free".`,
      );
    }

    switch (currentPlan) {
      case 'free':
        throw new PlanDowngradeError('Free plan cannot be downgraded further');
      case 'standard':
        if (planToDowngradeTo !== 'free') {
          throw new PlanDowngradeError(
            'Standard plan can only be downgraded to free',
          );
        }
        break;
      case 'premium':
        break;
      default:
        throw new PlanDowngradeError(`Unknown current plan: ${currentPlan}`);
    }

    await userService.updateUser(req.userId, 'plan', false, planToDowngradeTo);

    // const newLengthOfDocs: IPlans =
    //   planToDowngradeTo === 'standard'
    //     ? { standard: { max: 3, min: 0, current: 3 } }
    //     : { free: { max: 2, min: 0, current: 2 } };

        const newLengthOfDocs: IPlans = {
      [planToDowngradeTo]: PlanLimits[planToDowngradeTo],
    };

    await userService.updateUser(
      req.userId,
      'lengthOfDocs',
      false,
      newLengthOfDocs,
    );

    const maxDocsForPrevPlan =
      currentPlan === 'premium'
        ? user.lengthOfDocs.premium!.max
        : user.lengthOfDocs.standard!.max;

    const { documents } = await docService.getAllDocumentsByUserId(
      user,
      maxDocsForPrevPlan,
      0,
    );

    // const newChatBotPrompt: IPlans =
    //   planToDowngradeTo === 'standard'
    //     ? { standard: { max: 5, min: 0, current: 5 } }
    //     : { free: { max: 0, min: 0, current: 0 } };

     const newChatBotPrompt: IPlans = {
      [planToDowngradeTo]: ChatbotPlanLimits[planToDowngradeTo],
    };

    for (const doc of documents) {
      await docService.updateDocument(req.userId, doc.docId, {
        chatBotPrompt: newChatBotPrompt,
      });
    }

    ApiResponse.ok(res, 'User downgraded successfully');
  },
);

/**
 * DELETE USER CONTROLLER
 */
export const deleteUser = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const userService = container.resolve<IUserService>('IUserService');
    const docService = container.resolve<IDocumentService>('IDocumentService');
    const chatBotService =
      container.resolve<IChatBotService>('IChatBotService');

    const user = await userService.checkIfUserExist(req);
    if (!user) {
      throw new UserNotFoundError();
    }

    await Promise.allSettled([
      chatBotService.deleteChatHistoryByUserId(req.userId),
      docService.deleteAllDocuments(req.userId),
    ]);

    await userService.deleteUser(req.userId);

    const deletedFromEntraId = await userService.deleteUserFromEntraId(
      req.userId,
    );
    if (!deletedFromEntraId) {
      logger.warn('User not found in Entra ID for deletion', {
        userId: req.userId,
      });
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
