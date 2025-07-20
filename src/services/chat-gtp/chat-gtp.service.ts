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

/**
 * Types
 */
import { IDocument } from '@/models/document';

/**
 * Interfaces
 */
import { IChatGTPService } from './chat-gtp.interface';


@injectable()
export class ChatGTPService implements IChatGTPService{
  private readonly openai: OpenAI;

  constructor() {
    const apiKey = config.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_VALUE must be set in environment variables');
    }
    this.openai = new OpenAI({ apiKey });
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

    const prompt = this.buildPrompt(translatedText, targetLanguage);

    try {
      const completion = await this.openai.chat.completions.create({
        model: 'o3-mini',
        messages: [{ role: 'user', content: prompt }],
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
   * Builds the prompt for OpenAI with the document text and target language.
   * @param translatedText - The document text to process.
   * @param targetLanguage - The language for the response.
   * @returns The formatted prompt string.
   */
  private buildPrompt(translatedText: string, targetLanguage: string): string {
    return `
You are an assistant that reads documents and extracts the following fields from the document:
- title of the Document (string)
- date document was received (date string in ISO 8601 format, e.g. "2024-05-24")
- sender of document (From which institution) (string)
- short summary (string)
- actionPlan: an array of { title: string, reason: string }
- actionPlans: an array of { title: string, due_date: date string ISO 8601, completed: boolean, location: string }

Respond ONLY with valid raw JSON — do NOT include code fences, markdown, or extra text.
It is important that response should match the language ${targetLanguage}.

Example for an English Response:
{
  "title": "Residence Permit Decision",
  "receivedDate": "2024-05-24T00:00:00Z",
  "sender": "Auslander Behorde",
  "summary": "Your residence permit is expiring soon and you need to apply for an extension at least 8 weeks before the expiration date (2023-12-15). You'll need to provide several documents and book an appointment online.",
  "actionPlan": [
    { "title": "Prepare valid passport", "reason": "A valid passport is required for the application." },
    { "title": "Gather current employment contract", "reason": "An employment contract is needed to prove employment status." }
  ],
  "actionPlans": [
    { "title": "Apply for residence permit extension", "due_date": "2025-07-01T00:00:00Z", "completed": false, "location": "Auslander Behorde office" },
    { "title": "Submit all required documents online", "due_date": "2025-07-15T00:00:00Z", "completed": false, "location": "online portal" }
  ]
}

Document:
${translatedText}
`.trim();
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
      throw new Error('Invalid JSON response from OpenAI');
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
