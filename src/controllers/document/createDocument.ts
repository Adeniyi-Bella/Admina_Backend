/**
 * @copyright 2025 codewithsadee
 * @license Apache-2.0
 */

/**
 * Custom modules
 */
import { logger } from '@/lib/winston';

/**
 * Interfaces
 */
import { IAzureFreeSubscriptionService } from '@/services/azure/free-users/azure.free.interface';
import { IAzurePremiumSubscriptionService } from '@/services/azure/premium-users/azure.premium.interface';
import { IUserService } from '@/services/users/user.interface';
import { IChatGTPService } from '@/services/chat-gtp/chat-gtp.interface';
import { IDocumentService } from '@/services/document/document.interface';

/**
 * Node modules
 */
import { container } from 'tsyringe';
import type { Request, Response } from 'express';

const createDocument = async (req: Request, res: Response): Promise<void> => {
  const azureFreeSubscriptionService = container.resolve<IAzureFreeSubscriptionService>('IAzureFreeSubscriptionService');
  const azurePremiumSubscriptionService = container.resolve<IAzurePremiumSubscriptionService>('IAzurePremiumSubscriptionService');
  const userService = container.resolve<IUserService>('IUserService');
  const chatgtpService = container.resolve<IChatGTPService>('IChatGTPService');
  const documentService = container.resolve<IDocumentService>('IDocumentService');

  try {
    // Get data from request body
    const { docLanguage, targetLanguage } = req.body;
    const file = req.file!;

    // Retrieve user plan
    const user = await userService.checkIfUserExist(req);
    if (!user) {
      res.status(400).json({
        code: 'NotFound',
        message: 'User details not correct',
      });
      return;
    }

    // Set up SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    if (user.plan === 'free') {
      await azureFreeSubscriptionService.processFreeUserDocument({
        file,
        docLanguage,
        targetLanguage,
        userId: req.userId!.toString(),
        res,
        chatgtpService,
        documentService,
        userService,
      });
      res.end();
    } else if (user.plan === 'premium') {
      await azurePremiumSubscriptionService.processPremiumUserDocument({
        file,
        docLanguage,
        targetLanguage,
        userId: req.userId!.toString(),
        res,
        chatgtpService,
        documentService,
        userService
      });
      res.end();
    } else {
      res.status(400).write(
        `event: error\ndata: ${JSON.stringify({
          code: 'BadRequest',
          message: 'Invalid user data',
        })}\n\n`,
      );
      res.end();
      return;
    }
  } catch (error: any) {
    logger.error('Error during document processing', {
      error: error.message,
      stack: error.stack,
    });
    res.status(500).write(
      `event: error\ndata: ${JSON.stringify({
        code: 'ServerError',
        message: 'Failed to process document',
        error: 'Failed to process document',
        errorStatus: 500,
      })}\n\n`,
    );
    res.end();
    return;
  }
};

export default createDocument;