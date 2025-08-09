/**
 * @copyright 2025 Adeniyi Bella
 * @license Apache-2.0
 */

/**
 * Node modules
 */
import { injectable } from 'tsyringe';
import { v4 as uuidv4 } from 'uuid';
import type { Response } from 'express';

/**
 * Custom modules
 */
import config from '@/config';
import { logger } from '@/lib/winston';
import { handleSseAsyncOperation, sendSseMessage } from '../utils';

/**
 * Types
 */
import { ExtractTextResDTO } from '@/types/DTO';
import { OcrDetectionLanguage } from '@azure/cognitiveservices-computervision/esm/models';


/**
 * Services and Interfaces
 */
import { AzureSubscriptionBase } from '../base-class/azure.service';
import { IOpenAIService } from '@/services/openai/openai.interface';
import { IDocumentService } from '@/services/document/document.interface';
import { IUserService } from '@/services/users/user.interface';
import { IAzureFreeSubscriptionService } from './azure.free.interface';

/**
 * Models
 */
import { IDocument } from '@/models/document.model';



@injectable()
export class AzureFreeSubscriptionService
  extends AzureSubscriptionBase
  implements IAzureFreeSubscriptionService
{
  private readonly freePlanTranslateKey: string;
  private readonly freePlanTranslateEndpoint: string;
  private readonly freePlanTranslateRegion: string;
  private readonly apiVersion: string = '3.0';
  private readonly path: string = '/translate';

  constructor() {

    super();

    this.freePlanTranslateKey = config.FREE_PLAN_TRANSLATE_KEY!;
    this.freePlanTranslateEndpoint = config.FREE_PLAN_TRANSLATE_ENDPOINT!;
    this.freePlanTranslateRegion = config.FREE_PLAN_TRANSLATE_REGION!;

    if (
      !this.freePlanTranslateKey ||
      !this.freePlanTranslateEndpoint ||
      !this.freePlanTranslateRegion
    ) {
      throw new Error(
        'FREE_PLAN_TRANSLATE_KEY, FREE_PLAN_TRANSLATE_ENDPOINT, and FREE_PLAN_VISION_REGION must be set in environment variables',
      );
    }
  }

  public async translateText(
    text: ExtractTextResDTO,
    toLang: string,
  ): Promise<string> {
    try {
      logger.info('Translating text', { toLang });

      // Validate input
      if (!text.text || typeof text.text !== 'string') {
        throw new Error('Valid text is required for translation');
      }
      if (!toLang || typeof toLang !== 'string') {
        throw new Error('Valid target language is required');
      }

      const url = new URL(`${this.freePlanTranslateEndpoint}${this.path}`);
      url.searchParams.append('api-version', this.apiVersion);
      url.searchParams.append('to', toLang);

      const headers = {
        'Ocp-Apim-Subscription-Key': this.freePlanTranslateKey,
        'Ocp-Apim-Subscription-Region': this.freePlanTranslateRegion,
        'Content-Type': 'application/json',
        'X-ClientTraceId': uuidv4(),
      };

      // Fix: Use text.text and capitalize "Text" for Azure Translator API
      const body = JSON.stringify([{ Text: text.text }]);

      const response = await fetch(url.toString(), {
        method: 'POST',
        headers,
        body,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Translation failed: ${JSON.stringify(errorData)}`);
      }

      const data = await response.json();
      const translatedText = data[0]?.translations[0]?.text;

      if (!translatedText) {
        throw new Error('Translation failed — no text returned');
      }

      return translatedText;
    } catch (error) {
      logger.error('Translation failed', error);
      throw new Error(`Translation failed: ${error}`);
    }
  }

  public async processFreeUserDocument(params: {
    file: Express.Multer.File;
    docLanguage: OcrDetectionLanguage;
    targetLanguage: string;
    userId: string;
    res: Response;
    openAIService: IOpenAIService;
    documentService: IDocumentService;
    userService: IUserService;
  }): Promise<void> {
    const {
      file,
      docLanguage,
      targetLanguage,
      userId,
      res,
      openAIService,
      documentService,
      userService,
    } = params;

    // Send initial event
    sendSseMessage(res, 'message', 'Extracting text...');

    // Extract text from file
    const extractedText = await handleSseAsyncOperation(
      res,
      () => this.extractTextFromFile({ file, docLanguage, plan: 'free' }),
      'Failed to extract text from file',
    );


    // Send extracted text event
    sendSseMessage(res, 'extractedText', { extractedText: extractedText.text });

    // Proceed with translation
    const translatedText = await handleSseAsyncOperation(
      res,
      () => this.translateText(extractedText, targetLanguage),
      'Failed to translate text',
    );

    // Send translated text event
    sendSseMessage(res, 'translatedText', { translatedText });

    // Summarize translated text
    const summarizedText = await handleSseAsyncOperation(
      res,
      () =>
        openAIService.summarizeTranslatedText(translatedText, targetLanguage),
      'Failed to summarize translated text',
    );

    // Send summarized text event
    sendSseMessage(res, 'summarizedText', { summarizedText });

    // Create document in MongoDB
    const documentData: IDocument = {
      userId: userId.toString(),
      docId: uuidv4(),
      title: summarizedText.title || '',
      sender: summarizedText.sender || '',
      receivedDate: summarizedText.receivedDate || new Date(),
      summary: summarizedText.summary || '',
      translatedText,
      targetLanguage,
      actionPlan: summarizedText.actionPlan || [],
      actionPlans: (summarizedText.actionPlans || []).map((plan: any) => ({
        id: plan.id || uuidv4(),
        title: plan.title || '',
        dueDate: plan.dueDate || new Date(),
        completed: plan.completed ?? false,
        location: plan.location || '',
      })),
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const createdDocument = await handleSseAsyncOperation(
      res,
      () => documentService.createDocumentByUserId(documentData),
      'Failed to create document in MongoDB',
    );

    sendSseMessage(res, 'createdDocument', { status: createdDocument.summary });

    // Update lengthOfDocs
    await handleSseAsyncOperation(
      res,
      () => userService.updateUser(userId, 'lenghtOfDocs', true, undefined),
      'Failed to update lenghtOfDocs for user',
    );

    // Signal completion
    sendSseMessage(res, 'complete', { status: 'completed' });
  }
}
