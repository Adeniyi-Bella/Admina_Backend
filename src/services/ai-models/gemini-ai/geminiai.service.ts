/**
 * @copyright 2025 Adeniyi Bella
 * @license Apache-2.0
 */

/**
 * Node modules
 */
import { GoogleGenAI } from "@google/genai";
import { v4 as uuidv4 } from 'uuid';
import { injectable } from 'tsyringe';

/**
 * Custom modules
 */
import { logger } from '@/lib/winston';
// import config from '@/config';
import { Prompt } from '../userPrompts';

/**
 * Types
 */
import { IDocument } from '@/models/document.model';

/**
 * Interfaces
 */
// import { IOpenAIService } from '../openai.interface';

@injectable()
export class GeminiAIService {
  private readonly geminiAi: GoogleGenAI;
  private readonly userPrompt: Prompt;
  private readonly model: string = "gemini-2.5-flash";

  constructor() {
    this.geminiAi = new GoogleGenAI({});
    this.userPrompt = new Prompt();
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
      const response = await this.geminiAi.models.generateContent({
        model: this.model,
        contents: [userPrompt],
      });

      const responseText = response.text;
      if (!responseText) {
        throw new Error('No response received from Gemini AI');
      }

      return this.parseResponse(responseText);
    } catch (error: any) {
      logger.error('Failed to generate action plan with Gemini AI', {
        error: error.message,
      });
      throw new Error('Failed to generate action plan with Gemini AI');
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
}
