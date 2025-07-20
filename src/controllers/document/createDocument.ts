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
import { IDocumentService } from '@/services/document/document.interface';
import { IChatGTPService } from '@/services/chat-gtp/chat-gtp.interface';

/**
 * Node modules
 */
import { container } from 'tsyringe';
import { v4 as uuidv4 } from 'uuid';

/**
 * Types
 */
import type { Request, Response } from 'express';
import { IDocument } from '@/models/document';

const createDocument = async (req: Request, res: Response): Promise<void> => {
  const azureService = container.resolve<IAzureService>('IAzureService');
  const chatgtpService = container.resolve<IChatGTPService>('IChatGTPService');
  const documentService =
    container.resolve<IDocumentService>('IDocumentService');

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
        })}\n\n`,
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
    res.write(
      `event: extractedText\ndata: ${JSON.stringify({ extractedText: extractedText.text })}\n\n`,
    );
    res.flush();

    // Proceed with translation
    const translatedText = await azureService.translateText(
      extractedText,
      targetLanguage,
    );

    // Send translated text event
    res.write(
      `event: translatedText\ndata: ${JSON.stringify({ translatedText })}\n\n`,
    );
    res.flush();

    const summarizedText = await chatgtpService.summarizeTranslatedText(
      translatedText,
      targetLanguage,
    );

    // Send translated text event
    res.write(
      `event: summarizedTextx\ndata: ${JSON.stringify({ summarizedText })}\n\n`,
    );
    res.flush();

    // Create document in MongoDB
    const documentData: IDocument = {
      userId: req.userId!.toString(),
      docId: uuidv4(),
      title: summarizedText.title || '',
      sender: summarizedText.sender || '',
      receivedDate: summarizedText.receivedDate || new Date(),
      summary: summarizedText.summary || '',
      originalText: extractedText.text,
      translatedText,
      sourceLanguage: docLanguage,
      targetLanguage,
      actionPlan: summarizedText.actionPlan || [],
      actionPlans: (summarizedText.actionPlans || []).map((plan) => ({
        id: plan.id || uuidv4(),
        title: plan.title || '',
        dueDate: plan.dueDate || new Date(),
        completed: plan.completed ?? false,
        location: plan.location || '',
      })),
    };

    const createdDocument = await documentService.createDocumentByUserId(
      documentData,
    );
    res.write(
      `event: createdDocument\ndata: ${JSON.stringify(createdDocument)}\n\n`,
    );
    res.flush();

    // Signal completion
    res.write('event: complete\ndata: {"status":"completed"}\n\n');
    res.end();
  } catch (error) {
    logger.error('Error during document processing', error);
    res.write(
      `event: error\ndata: ${JSON.stringify({
        code: 'ServerError',
        message: 'Internal server error',
        error: error,
      })}\n\n`,
    );
    res.end();
  }
};

export default createDocument;
