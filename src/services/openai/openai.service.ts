/**
 * @copyright 2025 Adeniyi Bella
 * @license Apache-2.0
 */

/**
 * Node modules
 */
import { OpenAI } from 'openai';
import { v4 as uuidv4 } from 'uuid';
import { injectable } from 'tsyringe';

/**
 * Custom modules
 */
import { logger } from '@/lib/winston';
import config from '@/config';
import { Prompt } from './userPrompts';

/**
 * Types
 */
import { IDocument } from '@/models/document.model';

/**
 * Interfaces
 */
import { IOpenAIService } from './openai.interface';
import { IChatBotHistory } from '@/models/chatbotHistory.model';

@injectable()
export class OpenAIService implements IOpenAIService {
  private readonly openai: OpenAI;
  private readonly userPrompt: Prompt;

  constructor() {
    const apiKey = config.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_VALUE must be set in environment variables');
    }
    this.openai = new OpenAI({ apiKey });
    this.userPrompt = new Prompt();
  }

   async chatBotStream(
    chatBotHistory: IChatBotHistory,
    userPrompt: string,
  ): Promise<AsyncIterable<OpenAI.Chat.Completions.ChatCompletionChunk>> {
    try {
      const messages = this.userPrompt.buildChatBotPrompt(chatBotHistory, userPrompt);
      const stream = await this.openai.chat.completions.create({
        model: 'gpt-4.1',
        messages,
        stream: true,
        temperature: 0.3,
      });
      return stream;
    } catch (error) {
      logger.error('Error initiating chatbot stream', {
        error,
        userId: chatBotHistory.userId,
        docId: chatBotHistory.docId,
      });
      throw error;
    }
  }

  /**
   * Restructures the provided text into a clearer and more readable layout using OpenAI.
   * @param text - The text to restructure.
   * @param label - The language label for the output (e.g., 'en', 'de').
   * @returns A promise resolving to the structured text.
   */
  public async structureText(text: string, label: string): Promise<string> {
    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4.1',
        temperature: 0.3,
        messages: [
          {
            role: 'user',
            content: this.userPrompt.structureTextPrompt(text, label),
          },
        ],
      });

      const summary =
        response.choices[0]?.message?.content?.trim() ||
        'No summary generated.';

      return summary;
    } catch (error: any) {
      logger.error('Error in structureText', {
        error: error.message,
        text,
        label,
      });
      throw error;
    }
  }

  /**
   * Shot summary and generates an action plan from the provided text in the specified target language.
   * @param translatedText - The original document text to process.
   * @param targetLanguage - The language for the response (e.g., 'en', 'de').
   * @returns A promise resolving to the document fields (excluding userId, docId, translatedText, translatedText, sourceLanguage, targetLanguage, created_at, updated_at).
   * @throws Error if the OpenAI request or JSON parsing fails.
   */
  public async summarizeTranslatedText(
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
  > {
    // Validate inputs
    if (!translatedText || typeof translatedText !== 'string') {
      throw new Error('Valid original text is required');
    }
    if (!targetLanguage || typeof targetLanguage !== 'string') {
      throw new Error('Valid target language is required');
    }

    const userPrompt = this.userPrompt.buildPrompt(translatedText, targetLanguage);

    try {
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4.1',
        temperature: 0.3,
        messages: [{ role: 'user', content: userPrompt }],
      });

      const response = completion.choices[0]?.message?.content;
      if (!response) {
        throw new Error('No response received from OpenAI');
      }

      return this.parseResponse(response);
    } catch (error) {
      logger.error('Failed to generate action plan', {
        error: error,
        translatedText,
        targetLanguage,
      });
      return this.getDefaultResponse();
    }
  }

  /**
   * Parses the OpenAI response and normalizes it to match the IDocument interface.
   * @param response - The raw JSON response from OpenAI.
   * @returns The parsed and normalized document fields.
   * @throws Error if JSON parsing fails.
   */
  private parseResponse(
    response: string,
  ): Pick<
    IDocument,
    | 'title'
    | 'sender'
    | 'receivedDate'
    | 'summary'
    | 'actionPlan'
    | 'actionPlans'
  > {
    try {
      const parsed = JSON.parse(response);

      // Validate required fields
      if (!parsed.title || typeof parsed.title !== 'string') {
        parsed.title = '';
      }
      if (!parsed.sender || typeof parsed.sender !== 'string') {
        parsed.sender = '';
      }
      if (!parsed.summary || typeof parsed.summary !== 'string') {
        parsed.summary = '';
      }

      // Parse receivedDate safely
      const receivedDate =
        parsed.receivedDate && !isNaN(new Date(parsed.receivedDate).getTime())
          ? new Date(parsed.receivedDate)
          : new Date();

      // Normalize actionPlan array
      const actionPlan = Array.isArray(parsed.actionPlan)
        ? parsed.actionPlan.map((item: any) => ({
            title: typeof item.title === 'string' ? item.title : '',
            reason: typeof item.reason === 'string' ? item.reason : '',
          }))
        : [];

      // Normalize actionPlans array
      const actionPlans = Array.isArray(parsed.actionPlans)
        ? parsed.actionPlans.map((item: any) => ({
            id: uuidv4(),
            title: typeof item.title === 'string' ? item.title : '',
            dueDate:
              item.due_date && !isNaN(new Date(item.due_date).getTime())
                ? new Date(item.due_date)
                : new Date(),
            completed:
              typeof item.completed === 'boolean' ? item.completed : false,
            location: typeof item.location === 'string' ? item.location : '',
          }))
        : [];

      return {
        title: parsed.title,
        sender: parsed.sender,
        receivedDate,
        summary: parsed.summary,
        actionPlan,
        actionPlans,
      };
    } catch (error) {
      logger.error('Failed to parse OpenAI response', {
        response,
        error: error,
      });
      throw error;
    }
  }

  /**
   * Returns a default response when the OpenAI request or parsing fails.
   * @returns Default document fields.
   */
  private getDefaultResponse(): Pick<
    IDocument,
    | 'title'
    | 'sender'
    | 'receivedDate'
    | 'summary'
    | 'actionPlan'
    | 'actionPlans'
  > {
    return {
      title: '',
      sender: '',
      receivedDate: new Date(),
      summary: 'Failed to generate action plan. Please try again later.',
      actionPlan: [],
      actionPlans: [],
    };
  }
}
