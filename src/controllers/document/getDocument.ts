import { ApiResponse } from '@/lib/api_response';
import { logger } from '@/lib/winston';
import { IChatMessage } from '@/models/chatbotHistory.model';
// import { IAzureBlobService } from '@/services/azure/azure-blob-storage/azure.blobStorage.interface';
import { IChatBotService } from '@/services/chatbot/chatbot.interface';
import { IDocumentService } from '@/services/document/document.interface';
import { IUserService } from '@/services/users/user.interface';
import type { Request, Response } from 'express';
import { container } from 'tsyringe';

const getDocument = async (req: Request, res: Response): Promise<void> => {
  const documentService =
    container.resolve<IDocumentService>('IDocumentService');
  const chatBotService = container.resolve<IChatBotService>('IChatBotService');
  const userService = container.resolve<IUserService>('IUserService');
  // const azureBlobService =
  //   container.resolve<IAzureBlobService>('IAzureBlobService');

  try {
    const userId = req.userId;
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
    let chats: IChatMessage[] = [];
    try {
      const chatHistory = await chatBotService.getDocumentChatBotCollection(
        userId,
        docId,
      );
      chats = chatHistory?.chats || [];
    } catch (error) {
      logger.warn('Chat history not found, returning empty chats array', {
        userId,
        docId,
        error,
      });
    }

    // if (user.plan === 'premium' && document?.pdfBlobStorage) {
    //   try {
    //     const pdfFile = await azureBlobService.downloadPdfFromBlob(
    //       'download',
    //       `${userId}/${docId}`,
    //     );
    //     ApiResponse.ok(res, 'Document fetched successfully', {
    //       document,
    //       chats,
    //       pdf: pdfFile.buffer.toString('base64'),
    //     });

    //     return;
    //   } catch (pdfError: any) {
    //     logger.error('Failed to download translated PDF for premium user', {
    //       userId,
    //       docId,
    //       error: pdfError.message,
    //     });
    //     ApiResponse.serverError(
    //       res,
    //       'PDF Download error from blob storage',
    //       pdfError.message,
    //     );

    //     return;
    //   }
    // }
    ApiResponse.ok(res, 'Document fetched successfully', {
      document,
      chats,
      userPlan: user.plan,
    });
  } catch (error: unknown) {
    logger.error('Error fetching document', error);
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    ApiResponse.serverError(res, 'Internal server error', errorMessage);
  }
};

export default getDocument;
