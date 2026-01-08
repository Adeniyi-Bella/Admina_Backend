/**
 * @copyright 2025 Adeniyi Bella
 * @license Apache-2.0
 */

/**
 * Models
 */
import ChatBotHistory, {
  IChatBotHistory,
  IChatMessage,
} from '@/models/chatbotHistory.model';

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
  async getDocumentChatBotCollection(
    userId: string,
    docId: string,
  ): Promise<IChatBotHistory | null> {
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

      return result;
    } catch (error) {
      logger.error('Failed to retrieve chat history collection', {
        error,
        userId,
        docId,
      });
      throw new Error(`Failed to retrieve chat history collection: ${error}`);
    }
  }
  async updateDocumentChatBotHistory(
    userId: string,
    docId: string,
    chat: IChatMessage,
  ): Promise<void> {
    try {
      if (!userId || !docId || !chat || !chat.userPrompt || !chat.response) {
        throw new Error(
          'User ID, Document ID, and valid chat data are required',
        );
      }

      const result = await ChatBotHistory.updateOne(
        { userId, docId },
        { $push: { chats: chat } },
      ).exec();

      if (result.matchedCount === 0) {
        throw new Error('Chat history collection not found for update');
      }

      logger.info('Chat history collection updated successfully', {
        userId,
        docId,
      });
    } catch (error) {
      logger.error('Failed to update chat history collection', {
        error,
        userId,
        docId,
      });
      throw new Error(`Failed to update chat history collection: ${error}`);
    }
  }

  async createChatHistory(
    chatBotHistory: Partial<IChatBotHistory>,
  ): Promise<IChatBotHistory> {
    try {
      if (!chatBotHistory || !chatBotHistory.userId || !chatBotHistory.docId) {
        throw new Error('Valid chat history data is required');
      }

      const result = await ChatBotHistory.create(chatBotHistory);

      return result.toObject() as IChatBotHistory;
    } catch (error: any) {
      if (error.code === 11000) {
        logger.error('Chat history already exists for this document', {
          userId: chatBotHistory.userId,
          docId: chatBotHistory.docId,
        });
        throw new Error('Chat history already exists for this document');
      }
      logger.error('Failed to create chat history collection', {
        error: error,
      });
      throw new Error(`Failed to create chat history collection: ${error}`);
    }
  }

  async deleteChatHistoryByUserId(userId: string): Promise<boolean> {
    try {
      if (!userId) {
        throw new Error('User ID is required');
      }

      await ChatBotHistory.deleteMany({ userId }).exec();

      logger.info('Chat history deleted successfully', { userId });
      return true;
    } catch (error) {
      logger.error('Failed to delete chat history', { error, userId });
      throw new Error(`Failed to delete chat history: ${error}`);
    }
  }

  async deleteChatHistoryByDocument(
    userId: string,
    docId: string,
  ): Promise<boolean> {
    try {
      if (!userId || !docId) {
        throw new Error('User ID is required');
      }

      const result = await ChatBotHistory.deleteOne({ userId, docId }).exec();

      if (result.deletedCount === 0) {
        logger.info('No chat history found for user', { userId, docId });
      }

      logger.info('Chat history deleted successfully', { userId, docId });
      return true;
    } catch (error) {
      logger.error('Failed to delete chat history', { error, userId });
      throw new Error(`Failed to delete chat history: ${error}`);
    }
  }
}
