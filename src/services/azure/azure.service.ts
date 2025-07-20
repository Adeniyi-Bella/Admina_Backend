/**
 * @copyright 2025 Adeniyi Bella
 * @license Apache-2.0
 */

/**
 * Interfaces
 */
import { IAzureService } from './azure.interface';

/**
 * Node modules
 */
import { injectable } from 'tsyringe';
import { ComputerVisionClient } from '@azure/cognitiveservices-computervision';
import { ApiKeyCredentials } from '@azure/ms-rest-js';
import { promisify } from 'util';
import { v4 as uuidv4 } from 'uuid';

/**
 * Custom modules
 */
import config from '@/config';
import { logger } from '@/lib/winston';

/**
 * Types
 */
import { ExtractTextReqDTO, ExtractTextResDTO } from '@/types/DTO';
import { OcrDetectionLanguage } from '@azure/cognitiveservices-computervision/esm/models';

@injectable()
export class AzureService implements IAzureService {
  private readonly computerVisionClient: ComputerVisionClient;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly key: string;
  private readonly endpoint: string;
  private readonly location: string;
  private readonly apiVersion: string = '3.0';
  private readonly path: string = '/translate';

  constructor() {
    const extractionKey = config.VISION_KEY;
    const extractionEndpoint = config.VISION_ENDPOINT;
    this.key = config.TRANSLATOR_KEY!;
    this.endpoint = config.TRANSLATOR_ENDPOINT!;
    this.location = config.TRANSLATOR_LOCATION!;

    if (!extractionKey || !extractionEndpoint) {
      throw new Error(
        'VISION_KEY and VISION_ENDPOINT must be set in environment variables',
      );
    }
    if (!this.key || !this.endpoint || !this.location) {
      throw new Error(
        'TRANSLATOR_KEY, TRANSLATOR_ENDPOINT, and TRANSLATOR_LOCATION must be set in environment variables',
      );
    }

    this.computerVisionClient = new ComputerVisionClient(
      new ApiKeyCredentials({
        inHeader: { 'Ocp-Apim-Subscription-Key': extractionKey },
      }),
      extractionEndpoint,
    );
    this.sleep = promisify(setTimeout);
  }

  public async extractTextFromFile(
    data: ExtractTextReqDTO,
  ): Promise<ExtractTextResDTO> {
    try {
      logger.info('Extracting text from file', {
        fileSize: data.file.buffer.length,
        docLanguage: data.docLanguage,
      });

      // Validate input
      if (!data.file || !data.file.buffer) {
        throw new Error('Valid document file is required');
      }
      if (!data.docLanguage) {
        throw new Error('Valid source language is required');
      }

      // Convert File to Buffer (HttpRequestBody compatible)
      const buffer = data.file.buffer;

      // Perform text extraction using Azure Read API
      const readResult = await this.readTextFromStream(
        buffer,
        data.docLanguage as OcrDetectionLanguage,
      );

      // Extract text from results
      const extractedText = this.extractTextFromResults(readResult);

      return {
        text: extractedText,
      };
    } catch (error) {
      logger.error('Text extraction failed', error);
      throw new Error(`Text extraction failed: ${error}`);
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

      const url = new URL(`${this.endpoint}${this.path}`);
      url.searchParams.append('api-version', this.apiVersion);
      url.searchParams.append('to', toLang);

      const headers = {
        'Ocp-Apim-Subscription-Key': this.key,
        'Ocp-Apim-Subscription-Region': this.location,
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

  /**
   * Reads text from a buffer using Azure Computer Vision Read API
   * @param buffer - Buffer of the document
   * @param language - Language code for text extraction
   * @returns Promise with read results
   */
  private async readTextFromStream(
    buffer: Buffer,
    language: OcrDetectionLanguage,
  ): Promise<any> {
    // Call Azure Read API with the buffer
    const operationResponse = await this.computerVisionClient.readInStream(
      buffer,
      {
        language, // Use docLanguage from DTO
      },
    );

    // Get operation ID from the operationLocation header
    const operationId = operationResponse.operationLocation.split('/').pop();

    // Poll until the operation is complete
    let result = await this.computerVisionClient.getReadResult(operationId!);
    while (result.status !== 'succeeded') {
      if (result.status === 'failed') {
        throw new Error('Text extraction operation failed');
      }
      await this.sleep(1000);
      result = await this.computerVisionClient.getReadResult(operationId!);
    }

    return result.analyzeResult?.readResults ?? [];
  }

  /**
   * Extracts and formats text from Azure Read API results
   * @param readResults - Results from the Azure Read API
   * @returns Formatted text string
   */
  private extractTextFromResults(readResults: any[]): string {
    let extractedText = '';

    for (const page of readResults) {
      if (page.lines?.length) {
        for (const line of page.lines) {
          extractedText += line.words.map((w: any) => w.text).join(' ') + '\n';
        }
      }
    }

    return extractedText.trim() || 'No text recognized';
  }
}