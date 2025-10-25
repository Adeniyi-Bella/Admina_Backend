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
import { IDocument } from '@/models/document.model';

const translateDocument = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const geminiAIService =
    container.resolve<IGeminiAIService>('IGeminiAIService');
  const userService = container.resolve<IUserService>('IUserService');
  const documentService =
    container.resolve<IDocumentService>('IDocumentService');

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
    const translatedDocument = await geminiAIService.translateDocument(
      file,
      targetLanguage,
    );

    const docId = uuidv4();

    const documentData: IDocument = {
      userId: user.userId.toString(),
      docId,
      translatedText: translatedDocument.translatedText,
      structuredTranslatedText: translatedDocument.structuredTranslatedText,
      targetLanguage,
      pdfBlobStorage: false
    };

    const createDocument =
      await documentService.createDocumentByUserId(documentData);

    if (!createDocument) throw new Error('Error during document Creation');

    ApiResponse.ok(res, 'Translation complete', {
      docId: createDocument.docId,
    });
  } catch (error: any) {
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

export default translateDocument;
