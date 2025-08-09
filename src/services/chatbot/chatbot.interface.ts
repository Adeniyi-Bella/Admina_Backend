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
  ): Promise<IChatBotHistory>;
  updateDocumentChatBotHistory(
    userId: string,
    docId: string,
    chat: IChatMessage,
  ): Promise<void>;
}
