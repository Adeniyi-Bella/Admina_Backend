/**
 * @copyright 2025 Adeniyi Bella
 * @license Apache-2.0
 */

/**
 * Node modules
 */
import { container } from 'tsyringe';

/**
 * Custom modules
 */
import { logger } from '@/lib/winston';
import { IUserService } from '@/services/users/user.interface';

/**
 * Types
 */
import type { Request, Response } from 'express';
import { IChatBotService } from '@/services/chatbot/chatbot.interface';
import { IChatBotHistory, IChatMessage } from '@/models/chatbotHistory.model';
import { IDocumentService } from '@/services/document/document.interface';
import { ApiResponse } from '@/lib/api_response';
import { IDocument } from '@/models/document.model';
import { IGeminiAIService } from '@/services/ai-models/gemini-ai/geminiai.interface';

const adminaChatBot = async (req: Request, res: Response): Promise<void> => {
  const chatBotService = container.resolve<IChatBotService>('IChatBotService');
  const userService = container.resolve<IUserService>('IUserService');
  const geminiService = container.resolve<IGeminiAIService>('IGeminiAIService');
  const documentService =
    container.resolve<IDocumentService>('IDocumentService');

  try {
    const { userPrompt } = req.body;
    const userId = req.userId;
    const docId = req.params.docId;
    const file = req.file;

    // Retrieve user plan
    const user = await userService.checkIfUserExist(req);
    if (!user) {
      logger.error(
        'User does not have a premium plan or user can no longer use the chatbot for the current month',
        { userId },
      );

      ApiResponse.badRequest(
        res,
        'User does not have a premium plan or user can no longer use the chatbot for the current month',
      );
      return;
    }

    const document = await documentService.getDocument(user, docId);

    if (!document) {
      logger.error('Document does not exist', { userId });

      ApiResponse.badRequest(res, 'Document does not exist');
      return;
    }

    // Retrieve chat history
    let chatHistory = await chatBotService.getDocumentChatBotCollection(
      userId,
      docId,
    );

    // Create new chat history when no chat history is available
    if (!chatHistory) {
      const newChatHistory: IChatBotHistory = {
        userId,
        docId,
        translatedText: (document as IDocument).translatedText,
        chats: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };


      chatHistory = await chatBotService.addTranslatedText(newChatHistory);
      logger.info('Created new ChatBotHistory', { userId, docId });
    }

    let completeResponse = '';
    let hasSentHeaders = false;

    const stream = geminiService.chatBotStream(chatHistory, userPrompt, file);

    for await (const chunk of stream) {
      // ONLY send headers if we successfully got the first chunk
      if (!hasSentHeaders) {
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.setHeader('Transfer-Encoding', 'chunked');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.flushHeaders();
        hasSentHeaders = true;
      }

      if (chunk) {
        completeResponse += chunk;
        res.write(chunk);
      }
    }

    if (completeResponse) {
      await documentService.updateDocument(userId, docId, {
        $inc: { [`chatBotPrompt.${user.plan}.current`]: -1 },
      });

      const newChat: IChatMessage = {
        userPrompt,
        response: completeResponse,
        time: new Date(),
      };
      await chatBotService.updateDocumentChatBotHistory(userId, docId, newChat);
    }
    res.end();
  } catch (err: any) {
    ApiResponse.serverError(res, 'Internal server error', err.message);

    logger.error('Error during chatbot interaction', {
      userId: req.userId,
      docId: req.params.docId,
      error: err.message,
    });
  }
};

export default adminaChatBot;
