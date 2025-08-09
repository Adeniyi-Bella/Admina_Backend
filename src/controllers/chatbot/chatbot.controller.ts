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
import { IOpenAIService } from '@/services/openai/openai.interface';
import { IChatBotHistory, IChatMessage } from '@/models/chatbotHistory.model';
import { IDocumentService } from '@/services/document/document.interface';

const adminaChatBot = async (req: Request, res: Response): Promise<void> => {
  const chatBotService = container.resolve<IChatBotService>('IChatBotService');
  const userService = container.resolve<IUserService>('IUserService');
  const openAiService = container.resolve<IOpenAIService>('IOpenAIService');
  const documentService =
    container.resolve<IDocumentService>('IDocumentService');

  try {
    const { prompt } = req.body;
    const userId = req.userId;
    const docId = req.params.docId;

    // Validate inputs
    if (!userId || !docId || !prompt) {
      res.status(400).json({
        code: 'BadRequest',
        message: 'User ID, Document ID, and prompt are required',
      });
      return;
    }

    // Retrieve user plan
    const user = await userService.checkIfUserExist(req);
    if (!user || user.plan !== 'premium') {
      logger.error(
        'User should have a premium plan to access chatbot feature',
        { userId },
      );
      res.status(403).json({
        code: 'Forbidden',
        message: 'User should have a premium plan to access chatbot feature',
      });
      return;
    }

    // Retrieve chat history
    let chatHistory = await chatBotService.getDocumentChatBotCollection(
      userId,
      docId,
    );

    if (!chatHistory) {
      // If no chat history exists, retrieve the Document
      const document = await documentService.getDocument(userId, docId);
      if (!document || !document.translatedText) {
        logger.error(
          'Document not found or missing translated text/target language',
          { userId, docId },
        );
        res.status(400).json({
          code: 'BadRequest',
          message:
            'Document not found or missing translated text/target language',
        });
        return;
      }

      // Create new ChatBotHistory
      const newChatHistory: IChatBotHistory = {
        userId,
        docId,
        translatedText: document.translatedText,
        chats: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      chatHistory = await chatBotService.addTranslatedText(newChatHistory);
      logger.info('Created new ChatBotHistory', { userId, docId });
    } else if (!chatHistory.translatedText) {
      logger.error(
        'Translated text or target language is missing in ChatBotHistory',
        { userId, docId },
      );
      res.status(400).json({
        code: 'BadRequest',
        message: 'Translated text is missing for this document',
      });
      return;
    }

    // Set response headers for streaming
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    res.flushHeaders();

    // Stream AI response
    let completeResponse = '';
    const stream = await openAiService.chatBotStream(chatHistory, prompt);
    for await (const chunk of stream) {
      logger.debug('Received stream chunk', { userId, docId, chunk });
      if (chunk.choices[0]?.delta?.content) {
        const content = chunk.choices[0].delta.content;
        completeResponse += content;
        res.write(`data: ${content}\n\n`);
      }
    }

    // After streaming is complete, update ChatBotHistory with the new prompt and response
    const newChat: IChatMessage = {
      prompt,
      response: completeResponse,
      time: new Date(),
    };
    await chatBotService.updateDocumentChatBotHistory(userId, docId, newChat);

    // End the response stream
    res.end();

    logger.info('Chatbot response streamed and history updated successfully', {
      userId,
      docId,
    });
  } catch (err) {
    res.status(500).json({
      code: 'ServerError',
      message: 'Internal server error',
      error: err,
    });

    logger.error('Error during chatbot interaction', {
      userId: req.userId,
      docId: req.params.docId,
      error: err,
    });
  }
};

export default adminaChatBot;
