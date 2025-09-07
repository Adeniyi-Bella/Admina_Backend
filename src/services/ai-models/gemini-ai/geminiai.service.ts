/**
 * @copyright 2025 Adeniyi Bella
 * @license Apache-2.0
 */

/**
 * Node modules
 */
import { GoogleGenAI } from '@google/genai';
import { v4 as uuidv4 } from 'uuid';
import { injectable } from 'tsyringe';

/**
 * Custom modules
 */
import { logger } from '@/lib/winston';
import config from '@/config';
import { Prompt } from '../userPrompts';

/**
 * Types
 */
import { IDocument } from '@/models/document.model';

/**
 * Interfaces
 */
import { IGeminiAIService } from './geminiai.interface';

@injectable()
export class GeminiAIService implements IGeminiAIService {
  private readonly geminiAi: GoogleGenAI;
  private readonly userPrompt: Prompt;
  private readonly model: string = 'gemini-2.5-flash';

  constructor() {
    console.log('GEMINI API KEY:', config.GEMINI_API_KEY);
    this.geminiAi = new GoogleGenAI({
      apiKey: config.GEMINI_API_KEY!,
    });

    this.userPrompt = new Prompt();
  }

  public async analyzePDFDocument(
    file: Express.Multer.File,
    targetLanguage: string,
  ): Promise<Partial<IDocument>> {
    // Validate inputs
    if (!file || !file.buffer) {
      throw new Error('PDF file buffer is required');
    }

    const userPrompt = this.userPrompt.buildPromptForGeminiAI(targetLanguage);

    try {
      const contents = [
        { text: userPrompt },
        {
          inlineData: {
            mimeType: 'application/pdf',
            data: file.buffer.toString('base64'),
          },
        },
      ];

      const response = await this.geminiAi.models.generateContent({
        model: this.model,
        contents,
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
  private parseResponse(response: string): Partial<IDocument> {
    try {
      const cleanResponse = response
        .trim()
        .replace(/^```(?:json)?/i, '')
        .replace(/```$/, '')
        .trim();

      const parsed = JSON.parse(cleanResponse);

      return {
        translatedText: parsed.translatedText ?? '',
        structuredTranslatedText: parsed.structuredTranslatedText ?? {},
        title: parsed.title ?? '',
        sender: parsed.sender ?? '',
        receivedDate: parsed.receivedDate ?? new Date().toISOString(),
        summary: parsed.summary ?? '',
        actionPlan: parsed.actionPlan ?? [],
        actionPlans: Array.isArray(parsed.actionPlans)
          ? parsed.actionPlans.map((item: any) => ({
              id: uuidv4(),
              title: item.title ?? '',
              dueDate: item.due_date ?? new Date().toISOString(),
              completed: item.completed ?? false,
              location: item.location ?? '',
            }))
          : [],
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
