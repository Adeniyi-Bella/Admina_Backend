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

const translateQueueService = new TranslateQueueService();

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

    // Check Lock
    const isProcessing = await translateQueueService.isUserProcessing(
      user.email!,
    );
    if (isProcessing) {
      ApiResponse.badRequest(
        res,
        'You already have a document being processed',
      );
      return;
    }

    const docId = uuidv4();

    // We convert the Buffer to a Base64 string so it can safely travel through Redis/BullMQ
    const cleanFilePayload = {
      originalname: file.originalname,
      mimetype: file.mimetype,
      // encoding: file.encoding,
      buffer: file.buffer.toString('base64'),
    };

    const jobPayload = {
      file: cleanFilePayload,
      targetLanguage,
      user,
      docId,
    };

    await translateQueueService.addTranslationJob(
      docId,
      jobPayload,
      user.email!,
    );

    ApiResponse.ok(res, 'Document queued for translation', { docId });
  } catch (error: any) {
    // 1. HANDLE WORKER OFFLINE (503)
    if (error.message === 'WORKER_OFFLINE') {
      logger.error('Translation service is offline');
      ApiResponse.serviceUnavailable(
        res,
        'Translation service is currently offline. Please try again later.',
      );
      return;
    }

    // 2. HANDLE MAX QUEUE ERROR (429)
    if (error.message === 'QUEUE_FULL') {
      logger.warn('Queue limit exceeded');
      ApiResponse.tooManyRequests(
        res,
        'Server is busy. Max queue length exceeded. Please try again later.',
      );
      return;
    }

    // Cleanup lock if error occurred
    if (req.email) await translateQueueService.releaseUserLock(req.email);

    logger.error('Error during document processing', { error: error.message });
    ApiResponse.serverError(
      res,
      'Error during document processing',
      error.message,
    );
  }
};

export default createDocument;
