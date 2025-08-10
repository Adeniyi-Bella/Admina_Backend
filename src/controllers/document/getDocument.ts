import { logger } from '@/lib/winston';
import { IChatMessage } from '@/models/chatbotHistory.model';
import { IAzureBlobService } from '@/services/azure/azure-blob-storage/azure.blobStorage.interface';
import { IChatBotService } from '@/services/chatbot/chatbot.interface';
import { IDocumentService } from '@/services/document/document.interface';
import { IUserService } from '@/services/users/user.interface';
import type { Request, Response } from 'express';
import { container } from 'tsyringe';

const getDocument = async (req: Request, res: Response): Promise<void> => {
  const documentService = container.resolve<IDocumentService>('IDocumentService');
  const chatBotService = container.resolve<IChatBotService>('IChatBotService');
  const userService = container.resolve<IUserService>('IUserService');
  const azureBlobService = container.resolve<IAzureBlobService>('IAzureBlobService');

  try {
    const userId = req.userId;
    const docId = req.params.docId;

    // Retrieve user plan
    const user = await userService.checkIfUserExist(req);
    if (!user) {
      res.status(400).json({
        code: 'NotFound',
        message: 'User details not correct',
      });
      return;
    }

    // Get the document
    const document = await documentService.getDocument(userId!, docId);
    if (!document) {
      res.status(404).json({
        code: 'NotFound',
        message: 'Document not found for this user',
      });
      return;
    }

    // Get chat history
    let chats: IChatMessage[] = [];
    try {
      const chatHistory = await chatBotService.getDocumentChatBotCollection(userId, docId);
      chats = chatHistory.chats || [];
    } catch (error) {
      logger.warn('Chat history not found, returning empty chats array', {
        userId,
        docId,
        error,
      });
    }

    if (user.plan === 'premium') {
      try {
        const pdfFile = await azureBlobService.downloadPdfFromBlob(
          'download',
          `${userId}/${docId}`
        );

        // return base64-encoded PDF
        res.status(200).json({
          document,
          chats,
          pdf: pdfFile.buffer.toString('base64'),
        });
        return;

      } catch (pdfError) {
        logger.error('Failed to download translated PDF for premium user', {
          userId,
          docId,
          error: pdfError,
        });
        res.status(500).json({
          code: 'PDFDownloadError',
          message: 'Failed to retrieve translated PDF for premium user',
        });
        return;
      }
    }

    // Free users → only document and chats
    res.status(200).json({ document, chats });

  } catch (err) {
    logger.error('Error while getting document by userId and docId', err);
    res.status(500).json({
      code: 'ServerError',
      message: 'Internal server error',
      error: err,
    });
  }
};

export default getDocument;
