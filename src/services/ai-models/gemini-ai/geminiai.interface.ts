/**
 * @copyright 2025 Adeniyi Bella
 * @license Apache-2.0
 */

import 'multer';
/**
 * Types
 */
import { IChatBotHistory } from '@/models/chatbotHistory.model';
import { IDocument } from '@/models/document.model';
import { FileMulter } from '@/types';


export interface IGeminiAIService {
  summarizeDocument(
    tranlatedText: string,
    targetLanguage: string,
  ): Promise<Partial<IDocument>>;

  translateDocument(
    file: FileMulter,
    targetLanguage: string,
  ): Promise<Partial<IDocument>>;

  chatBotStream(
    chatBotHistory: IChatBotHistory,
    userPrompt: string,
    file?: Express.Multer.File,
  ):  AsyncGenerator<string, void, unknown>;
}
