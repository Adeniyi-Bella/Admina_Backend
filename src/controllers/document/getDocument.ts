import { logger } from '@/lib/winston';
import { IChatMessage } from '@/models/chatbotHistory.model';
import { IChatBotService } from '@/services/chatbot/chatbot.interface';
import { IDocumentService } from '@/services/document/document.interface';
import type { Request, Response } from 'express';
import { container } from 'tsyringe';

const getDocument = async (req: Request, res: Response): Promise<void> => {
  const documentService =
    container.resolve<IDocumentService>('IDocumentService');
    const chatBotService = container.resolve<IChatBotService>('IChatBotService');

  try {
    const userId = req.userId;
    const docId = req.params.docId;

    const document = await documentService.getDocument(userId!, docId);

    if (!document) {
      res.status(404).json({
        code: 'NotFound',
        message: 'Document not found for this user',
      });
      return;
    }

    // Retrieve the chat history, return empty chats array if not found
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

    res.status(200).json({ document, chats });
  } catch (err) {
    res.status(500).json({
      code: 'ServerError',
      message: 'Internal server error',
      error: err,
    });

    logger.error('Error while getting document by userId and docId', err);
  }
};

export default getDocument;
