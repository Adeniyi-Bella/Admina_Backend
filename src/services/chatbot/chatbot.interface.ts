/**
 * @copyright 2025 Adeniyi Bella
 * @license Apache-2.0
 */

import { IChatBotHistory, IChatMessage } from '@/models/chatbotHistory.model';

/**
 * Types
 */

export interface IChatBotService {
  addTranslatedText(chatBotHistory: Partial<IChatBotHistory>): Promise<IChatBotHistory>;
  getDocumentChatBotCollection(
    userId: string,
    docId: string,
  ): Promise<IChatBotHistory | null>;
  updateDocumentChatBotHistory(
    userId: string,
    docId: string,
    chat: IChatMessage,
  ): Promise<void>;

  deleteChatHistoryByUserId(userId: string): Promise<boolean>
  deleteChatHistoryByDocument(userId: string, docId: string): Promise<boolean>
}
