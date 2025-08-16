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

export interface IOpenAIService {
  //   summarizeTranslatedText(data: ExtractTextReqDTO): Promise<ExtractTextResDTO>;
  summarizeTranslatedText(
    translatedText: string,
    targetLanguage: string,
  ): Promise<
    Pick<
      IDocument,
      | 'title'
      | 'sender'
      | 'receivedDate'
      | 'summary'
      | 'actionPlan'
      | 'actionPlans'
    >
  >;

  structureText(text: string, label: string): Promise<string>;
 chatBotStream(
    chatBotHistory: IChatBotHistory,
    userPrompt: string,
  ): Promise<AsyncIterable<OpenAI.Chat.Completions.ChatCompletionChunk>>

}
