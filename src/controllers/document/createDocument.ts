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
import { IOpenAIService } from '@/services/openai/openai.interface';
import { IDocumentService } from '@/services/document/document.interface';

/**
 * Node modules
 */
import { container } from 'tsyringe';
import type { Request, Response } from 'express';
import { IChatBotService } from '@/services/chatbot/chatbot.interface';
import { ApiResponse } from '@/lib/api_response';

const createDocument = async (req: Request, res: Response): Promise<void> => {
  const azureFreeSubscriptionService =
    container.resolve<IAzureFreeSubscriptionService>(
      'IAzureFreeSubscriptionService',
    );
  const azurePremiumSubscriptionService =
    container.resolve<IAzurePremiumSubscriptionService>(
      'IAzurePremiumSubscriptionService',
    );
  const userService = container.resolve<IUserService>('IUserService');
  const openAIService = container.resolve<IOpenAIService>('IOpenAIService');
  const documentService =
    container.resolve<IDocumentService>('IDocumentService');
  const chatBotService = container.resolve<IChatBotService>('IChatBotService');

  try {
    // Get data from request body
    const { docLanguage, targetLanguage } = req.body;
    const file = req.file!;

    // Retrieve user plan
    const user = await userService.checkIfUserExist(req);
    if (!user) {
      if (!res.headersSent) ApiResponse.notFound(res, 'User not found');
      return;
    }

    // Set up SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    if (user.plan === 'free' && user.lengthOfDocs.free?.current) {
      await azureFreeSubscriptionService.processFreeUserDocument({
        file,
        docLanguage,
        targetLanguage,
        userId: req.userId!.toString(),
        res,
        openAIService,
        documentService,
        userService,
      });
      if (!res.headersSent) res.end();
    } else if (user.plan === 'premium' && user.lengthOfDocs.premium?.current) {
      await azurePremiumSubscriptionService.processPremiumUserDocument({
        file,
        docLanguage,
        targetLanguage,
        userId: req.userId!.toString(),
        res,
        openAIService,
        documentService,
        userService,
        chatBotService,
      });
      if (!res.headersSent) res.end();
    } else {
      if (!res.headersSent) ApiResponse.badRequest(
        res,
        'Invalid user data or user has processed maximum document for the month.',
      );
      res.end();
      return;
    }
  } catch (error: any) {
    logger.error('Error during document processing', {
      error: error.message,
    });
    if (!res.headersSent) ApiResponse.serverError(res, 'Internal server error', error.message);
    res.end();
    return;
  }
};

export default createDocument;
