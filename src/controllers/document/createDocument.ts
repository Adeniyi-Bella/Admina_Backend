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
import { IUserService } from '@/services/users/user.interface';
import { IDocumentService } from '@/services/document/document.interface';
import { IGeminiAIService } from '@/services/ai-models/gemini-ai/geminiai.interface';

/**
 * Node modules
 */
import { container } from 'tsyringe';
import type { Request, Response } from 'express';
import { ApiResponse } from '@/lib/api_response';
import { IPlans } from '@/types';
import pdf from 'pdf-parse';
import { v4 as uuidv4 } from 'uuid';
import { TranslateQueueService } from '@/services/ai-models/jobs/job-queues.service';

const queueService = new TranslateQueueService();

const createDocument = async (req: Request, res: Response): Promise<void> => {
  const userService = container.resolve<IUserService>('IUserService');

  try {
    // Get data from request body
    const { targetLanguage } = req.body;
    const file = req.file!;

    // Retrieve user plan
    const user = await userService.checkIfUserExist(req);
    if (!user) {
      ApiResponse.notFound(res, 'User not found');
      return;
    }

    if (queueService.isUserProcessing(user.email!)) {
      ApiResponse.badRequest(
        res,
        'You already have a document being processed',
      );
      return;
    }

    // Mark user as processing
    queueService.addUserToProcessing(user.email!);

    const userPlan = user.plan as keyof IPlans;

    if (userPlan !== 'free' && userPlan !== 'standard') {
      logger.error('Invalid user plan for document summarizing', {
        userId: user.userId,
        plan: user.plan,
      });
      ApiResponse.badRequest(res, 'Invalid user plan.');
      return;
    }

    if (user.lengthOfDocs[userPlan]?.current! < 1) {
      ApiResponse.badRequest(
        res,
        'User has processed maximum document for the month.',
      );
      return;
    }

    if (file.mimetype === 'application/pdf') {
      const data = await pdf(file.buffer);
      const numpages = data.numpages || 0;
      if (user.plan === 'free' && numpages > 2) {
        logger.error('Page count exceeds limit for free users', {
          userId: user.userId,
          numpages,
        });
        ApiResponse.badRequest(res, 'Page count exceeds limit for free users.');
        return;
      }
    }
    const docId = uuidv4();
    await queueService.enqueueTranslationJob(docId, {
      file,
      targetLanguage,
      user,
    });

    ApiResponse.ok(res, 'Document queued for translation', { docId });
  } catch (error: any) {
    if (req.userId && req.email) queueService.removeUserFromProcessing(req.email);
    logger.error('Error during document processing', {
      error: error.message,
    });

    ApiResponse.serverError(
      res,
      'Error during document processing',
      error.message,
    );
  }
};

export default createDocument;
