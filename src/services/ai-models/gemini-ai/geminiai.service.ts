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
import { IChatBotHistory } from '@/models/chatbotHistory.model';

@injectable()
export class GeminiAIService implements IGeminiAIService {
  private readonly geminiAi: GoogleGenAI;
  private readonly userPrompt: Prompt;
  private readonly model: string = 'gemini-2.5-flash';

  constructor() {
    this.geminiAi = new GoogleGenAI({
      apiKey: config.GEMINI_API_KEY!,
    });

    this.userPrompt = new Prompt();
  }

  public async translateDocument(
    file: Express.Multer.File,
    targetLanguage: string,
  ): Promise<Partial<IDocument>> {
    if (!file || !file.buffer) {
      throw new Error('Valid file is required for translation');
    }

    const userPrompt =
      this.userPrompt.buildPromptForTranslateDocument(targetLanguage);

    const contents = [
      { text: userPrompt },
      {
        inlineData: {
          mimeType: file.mimetype,
          data: file.buffer.toString('base64'),
        },
      },
    ];
    try {
      const response = await this.geminiAi.models.generateContent({
        model: this.model,
        contents,
         config: {
          responseMimeType: 'application/json', 
        },
      });

      if (!response) {
        logger.error('Gemini returned empty response', { response });
        throw new Error('Gemini returned empty response');
      }

      const responseText = response.text;
      if (!responseText) {
        throw new Error('No text returned from Gemini');
      }

      return this.parseResponse(responseText);
    } catch (error: any) {
      logger.error('❌ Gemini document translation failed', {
        message: error.message,
        name: error.name,
        stack: error.stack,
        cause: error.cause,
        isNetworkError: error.message?.includes('fetch failed'),
        hint: error.message?.includes('fetch failed')
          ? 'Likely a network or API connection issue (check endpoint and key).'
          : 'Internal Gemini processing error.',
      });

      throw new Error(error || 'Gemini document translation failed');
    }
  }

  public async summarizeDocument(
    tranlatedText: string,
    targetLanguage: string,
  ): Promise<Partial<IDocument>> {
    const userPrompt = this.userPrompt.buildPromptForSummarizeDocument(
      tranlatedText,
      targetLanguage,
    );

    try {
      const contents = [{ text: userPrompt }];

      const response = await this.geminiAi.models.generateContent({
        model: this.model,
        contents,
         config: {
          responseMimeType: 'application/json', 
        },
      });

      const responseText = response.text;
      if (!responseText) {
        throw new Error('No response received from Gemini AI');
      }

      return this.parseResponse(responseText);
    } catch (error: any) {
      logger.error('❌ Gemini document summarization failed', {
        message: error.message,
        name: error.name,
        stack: error.stack,
        cause: error.cause,
        isNetworkError: error.message?.includes('fetch failed'),
        hint: error.message?.includes('fetch failed')
          ? 'Likely a network or API connection issue (check endpoint and key).'
          : 'Internal Gemini processing error.',
      });

      throw new Error(error || 'Gemini summarization translation failed');
    }
  }

  private parseResponse(response: string): Partial<IDocument> {
    try {
      let cleanResponse = response.trim();

      // 1. Try to extract strictly from Markdown code blocks first
      const codeBlockMatch = cleanResponse.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
      if (codeBlockMatch && codeBlockMatch[1]) {
        cleanResponse = codeBlockMatch[1].trim();
      } else {
        // 2. Fallback: Find the first '{' and the last '}'
        // This handles cases where the model doesn't use markdown but adds text like "Here is the JSON:"
        const firstBrace = cleanResponse.indexOf('{');
        const lastBrace = cleanResponse.lastIndexOf('}');

        if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
          cleanResponse = cleanResponse.substring(firstBrace, lastBrace + 1);
        }
      }

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
      logger.error('Failed to parse Gemini response', {
        originalResponse: response, // Log the original to debug
        error: error,
      });
      throw error;
    }
  }

   async *chatBotStream(
    chatBotHistory: IChatBotHistory,
    userPrompt: string,
    file?: Express.Multer.File 
  ):  AsyncGenerator<string, void, unknown> {
    try {
      const { systemInstruction, contents } = this.userPrompt.buildChatBotPrompt(
        chatBotHistory,
        userPrompt,
        file
      );

       const result = await this.geminiAi.models.generateContentStream({
        model: this.model,
        contents: contents,
        config: {
          systemInstruction: systemInstruction,
        },
      });

      // 3. Yield chunks as they arrive
      for await (const chunk of result) {
        const chunkText = chunk.text;
        if (chunkText) {
          yield chunkText;
        }
      }

    } catch (error: any) {
      logger.error('❌ Gemini chat bot failed', {
        message: error.message,
        name: error.name,
        stack: error.stack,
        cause: error.cause,
        isNetworkError: error.message?.includes('fetch failed'),
        hint: error.message?.includes('fetch failed')
          ? 'Likely a network or API connection issue (check endpoint and key).'
          : 'Internal Gemini processing error.',
      });

      throw new Error(error || 'Gemini chatbot failed');
    }
  }
}
