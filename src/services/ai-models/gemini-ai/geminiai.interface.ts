/**
 * @copyright 2025 Adeniyi Bella
 * @license Apache-2.0
 */

/**
 * Types
 */
import { IChatBotHistory } from '@/models/chatbotHistory.model';
import { IDocument } from '@/models/document.model';
import { OpenAI } from 'openai';

export interface IGeminiAIService {
  
    analyzePDFDocument(
    file: Express.Multer.File,
    targetLanguage: string,
  ): Promise<Partial<IDocument>>

}
