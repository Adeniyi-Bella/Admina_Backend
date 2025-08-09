/**
 * @copyright 2025 Adeniyi Bella
 * @license Apache-2.0
 */

/**
 * Models
 */
import ChatBotHistory, { IChatBotHistory, IChatMessage } from '@/models/chatbotHistory.model'

/**
 * Interfaces
 */
import { IChatBotService } from './chatbot.interface';

/**
 * Node modules
 */
import { injectable } from 'tsyringe';

/**
 * Custom modules
 */
import { logger } from '@/lib/winston';


@injectable()
export class ChatBotService implements IChatBotService {

  async getDocumentChatBotCollection(userId: string, docId: string): Promise<IChatBotHistory> {
    try {
      if (!userId || !docId) {
        throw new Error('User ID and Document ID are required');
      }

      const result = await ChatBotHistory.findOne({
        userId,
        docId,
      })
        .select('-__v')
        .lean()
        .exec();

      if (!result) {
        throw new Error('Chat history collection not found');
      }

      logger.info('Chat history collection retrieved successfully', { userId, docId });
      return result;
    } catch (error) {
      logger.error('Failed to retrieve chat history collection', { error, userId, docId });
      throw new Error(`Failed to retrieve chat history collection: ${error}`);
    }
  }
   async updateDocumentChatBotHistory(userId: string, docId: string, chat: IChatMessage): Promise<void> {
    try {
      if (!userId || !docId || !chat || !chat.prompt || !chat.response) {
        throw new Error('User ID, Document ID, and valid chat data are required');
      }

      const result = await ChatBotHistory.findOneAndUpdate(
        { userId, docId },
        { $push: { chats: chat } },
        { new: true }
      )
        .select('-__v')
        .lean()
        .exec();

      if (!result) {
        throw new Error('Chat history collection not found for update');
      }

      logger.info('Chat history collection updated successfully', { userId, docId });
    } catch (error) {
      logger.error('Failed to update chat history collection', { error, userId, docId });
      throw new Error(`Failed to update chat history collection: ${error}`);
    }
  }
  
  async addTranslatedText(chatBotHistory: Partial<IChatBotHistory>): Promise<IChatBotHistory> {
    try {
      if (!chatBotHistory || !chatBotHistory.userId || !chatBotHistory.docId) {
        throw new Error('Valid chat history data is required');
      }

      await ChatBotHistory.create(chatBotHistory);

      const result = await ChatBotHistory.findOne({
        userId: chatBotHistory.userId,
        docId: chatBotHistory.docId,
      })
        .select('-__v')
        .lean()
        .exec();

      if (!result) {
        throw new Error('Failed to retrieve New chat history collection');
      }

      logger.info('New chat history collection successfully created');
      return result
    } catch (error) {
      logger.error('Failed to create chat history collection', { error: error });
      throw new Error(`Failed to create chat history collection: ${error}`);
    }
  }
}

