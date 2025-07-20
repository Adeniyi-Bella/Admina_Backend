/**
 * @copyright 2025 codewithsadee
 * @license Apache-2.0
 */

/**
 * Custom modules
 */
import { logger } from '@/lib/winston';

/**
 * Interfaces
 */
import { IAzureService } from '@/services/azure/azure.interface';

/**
 * Node modules
 */
import { container } from 'tsyringe';

/**
 * Types
 */
import type { Request, Response } from 'express';

const createDocument = async (req: Request, res: Response): Promise<void> => {
  const azureService = container.resolve<IAzureService>('IAzureService');

  try {
    // Get data from request body
    const { docLanguage, targetLanguage } = req.body;
    const file = req.file;

    // Check if file exists
    if (!file) {
      res.write(
        `event: error\ndata: ${JSON.stringify({
          code: 'BadRequest',
          message: 'File is required',
        })}\n\n`
      );
      res.end();
      return;
    }

    // Set up SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    // Send initial event
    res.write('data: Extracting text...\n\n');
    res.flush();

    // Extract text from file
    const extractedText = await azureService.extractTextFromFile({
      file,
      docLanguage,
    });

    // Send extracted text event
    res.write(`event: extractedText\ndata: ${JSON.stringify({ extractedText: extractedText.text })}\n\n`);
    res.flush();

    // Proceed with translation
    const translatedText = await azureService.translateText(extractedText, targetLanguage);

    // Send translated text event
    res.write(`event: translatedText\ndata: ${JSON.stringify({ translatedText })}\n\n`);
    res.flush();

    // Signal completion
    res.write('event: complete\ndata: {"status":"completed"}\n\n');
    res.end();
  } catch (err) {
    logger.error('Error during document processing', err);
    res.write(
      `event: error\ndata: ${JSON.stringify({
        code: 'ServerError',
        message: 'Internal server error',
        error: err,
      })}\n\n`
    );
    res.end();
  }
};

export default createDocument;