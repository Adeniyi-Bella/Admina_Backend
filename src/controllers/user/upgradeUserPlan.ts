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
import { IDocumentService } from '@/services/document/document.interface';
import { ApiResponse } from '@/lib/api_response';

const upgradeUserPlan = async (req: Request, res: Response): Promise<void> => {
  const userService = container.resolve<IUserService>('IUserService');
  const docService = container.resolve<IDocumentService>('IDocumentService');

  try {
    // Retrieve user plan
    const user = await userService.checkIfUserExist(req);
    if (!user || user.plan !== 'free') {
      logger.error('User or User should have a free plan');
      ApiResponse.notFound(res, 'User not found');
      return;
    }

    await userService.updateUser(req.userId, 'plan', false, 'premium');

    await userService.updateUser(req.userId, 'lengthOfDocs', false, {
      premium: { max: 5, min: 0, current: 5 },
    });

    const { documents } = await docService.getAllDocumentsByUserId(
      req.userId,
      user.lengthOfDocs.free!.max,
      0,
    );
    for (const doc of documents) {
      await docService.updateDocument(req.userId, doc.docId, {
        chatBotPrompt: {
          premium: { max: 10, min: 0, current: 10 },
        },
      });
    }
    logger.info('User upgraded successfully and document per prompt updated successfully', { user: user });
    ApiResponse.ok(res, 'User upgraded successfully');
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    ApiResponse.serverError(res, 'Internal server error', errorMessage);
    logger.error('Error upgrading user', errorMessage);
  }
};

export default upgradeUserPlan;
