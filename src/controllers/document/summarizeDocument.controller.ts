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
import { v4 as uuidv4 } from 'uuid';
import { IActionPlan } from '@/models/document.model';

const summarizeDocument = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const geminiAIService =
    container.resolve<IGeminiAIService>('IGeminiAIService');
  const userService = container.resolve<IUserService>('IUserService');
  const documentService =
    container.resolve<IDocumentService>('IDocumentService');

  try {
    const reqDociId = req.params.docId;
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

    const document = await documentService.getDocument(user, reqDociId);

    if (!document) {
      ApiResponse.notFound(res, 'Document not found');
      return;
    }

    const summarizedTextDocument = await geminiAIService.summarizeDocument(
      document.translatedText!,
    );

    const documentData = {
      title: summarizedTextDocument.title || '',
      sender: summarizedTextDocument.sender || '',
      receivedDate: summarizedTextDocument.receivedDate || new Date(),
      summary: summarizedTextDocument.summary || '',
      actionPlan: summarizedTextDocument.actionPlan || [],
      actionPlans: (summarizedTextDocument.actionPlans || []).map(
        (plan: IActionPlan) => ({
          id: plan.id || uuidv4(),
          title: plan.title || '',
          dueDate: plan.dueDate || new Date(),
          completed: false,
          location: plan.location || '',
        }),
      ),
    };

    const updatedDocumentId = await documentService.updateDocument(
      user.userId,
      reqDociId,
      documentData,
    );

    if (!updatedDocumentId) throw new Error('Document cannot be updated');

    let isUpdatedLengthOfDoc;
    // Update lengthOfDocs
    if (user.plan === 'free') {
      isUpdatedLengthOfDoc = await userService.updateUser(
        user.userId,
        'lengthOfDocs.free.current',
        true,
        undefined,
      );
    } else if (user.plan === 'standard') {
      isUpdatedLengthOfDoc = await userService.updateUser(
        user.userId,
        'lengthOfDocs.standard.current',
        true,
        undefined,
      );
    }

    if (!isUpdatedLengthOfDoc)
      throw new Error('User plan could not be updated');

    ApiResponse.ok(res, 'Summary Completed', {
      docId: updatedDocumentId.docId,
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

export default summarizeDocument;
