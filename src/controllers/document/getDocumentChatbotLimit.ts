import { ApiResponse } from '@/lib/api_response';
import { logger } from '@/lib/winston';
import { IChatMessage } from '@/models/chatbotHistory.model';
import { IAzureBlobService } from '@/services/azure/azure-blob-storage/azure.blobStorage.interface';
import { IChatBotService } from '@/services/chatbot/chatbot.interface';
import { IDocumentService } from '@/services/document/document.interface';
import { IUserService } from '@/services/users/user.interface';
import { IPlans } from '@/types';
import type { Request, Response } from 'express';
import { container } from 'tsyringe';

const getDocumentChatbotLimit = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const documentService =
    container.resolve<IDocumentService>('IDocumentService');
  const userService = container.resolve<IUserService>('IUserService');

  try {
    const docId = req.params.docId;
    const user = await userService.checkIfUserExist(req);
    if (!user) {
      ApiResponse.notFound(res, 'User not found');
      return;
    }
    const document = await documentService.getDocument(user, docId);

    if (!document) {
      ApiResponse.notFound(res, 'Document not found');
      return;
    }

    const plan = user.plan as keyof IPlans;
    const docLimit = document.chatBotPrompt![plan];

    ApiResponse.ok(res, 'Document limit fetched successfully', {
      docLimit,
    });
  } catch (error: unknown) {
    logger.error('Error fetching document', error);
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    ApiResponse.serverError(res, 'Internal server error', errorMessage);
  }
};

export default getDocumentChatbotLimit;
