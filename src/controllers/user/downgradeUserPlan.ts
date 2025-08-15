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

const downgradeUserPlan = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const userService = container.resolve<IUserService>('IUserService');
  const docService = container.resolve<IDocumentService>('IDocumentService');

  try {
    // Retrieve user plan
    const user = await userService.checkIfUserExist(req);
    if (!user || user.plan !== 'premium') {
      logger.error('User or User should have a premium plan');
      ApiResponse.notFound(res, 'User not found');
      return;
    }

    await userService.updateUser(req.userId, 'plan', false, 'free');

    await userService.updateUser(req.userId, 'lengthOfDocs', false, {
      free: { max: 2, min: 0, current: 2 },
    });

    // Get all the documents when the user was a premium user
    const { documents } = await docService.getAllDocumentsByUserId(
      req.userId,
      user.lengthOfDocs.premium!.max,
      0,
    );
    for (const doc of documents) {
      await docService.updateDocument(req.userId, doc.docId, {
        chatBotPrompt: {
          free: { max: 0, min: 0, current: 0 },
        },
      });
    }
    logger.info(
      'User downgraded successfully and document per prompt updated successfully',
      { user: user },
    );

    ApiResponse.ok(res, 'User downgraded successfully');
  } catch (error: unknown) {
    logger.error('Error deleting document', error);
    // Check if error is an instance of Error to safely access message
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    ApiResponse.serverError(res, 'Internal server error', errorMessage);
  }
};

export default downgradeUserPlan;
