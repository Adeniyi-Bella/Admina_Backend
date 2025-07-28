import { logger } from '@/lib/winston';
import { IChatGTPService } from '@/services/chat-gtp/chat-gtp.interface';
import { IDocumentService } from '@/services/document/document.interface';
import type { Request, Response } from 'express';
import { container } from 'tsyringe';

const structureText = async (req: Request, res: Response): Promise<void> => {
  const documentService =
    container.resolve<IDocumentService>('IDocumentService');
  const chatgtpService = container.resolve<IChatGTPService>('IChatGTPService');

  try {
    const userId = req.userId;
    const docId = req.params.docId;

    const document = await documentService.getDocument(userId!, docId);

    if (!document) {
      res.status(404).json({
        code: 'NotFound',
        message: 'Document not found for this user',
      });
      return;
    }

    // Check if structured text fields already have content
    const hasStructuredText =
      typeof document.structuredOriginalText === 'string' &&
      document.structuredOriginalText.trim().length > 0 &&
      typeof document.structuredTranslatedText === 'string' &&
      document.structuredTranslatedText.trim().length > 0;

    if (hasStructuredText) {
      res.status(200).json({ document });
      return;
    }

    const structuredOriginalText = await chatgtpService.structureText(
      document.originalText,
      document.sourceLanguage,
    );
    const structuredTranslatedText = await chatgtpService.structureText(
      document.translatedText,
      document.targetLanguage,
    );

    // Update the document with structured texts
    const updatedDocument = await documentService.updateDocument(
      userId!,
      docId,
      {
        structuredOriginalText,
        structuredTranslatedText,
      },
    );

    if (!updatedDocument) {
      res.status(404).json({
        code: 'NotFound',
        message: 'Failed to update document',
      });
      return;
    }

    res.status(200).json({ document: updatedDocument });
  } catch (err) {
    res.status(500).json({
      code: 'ServerError',
      message: 'Internal server error',
      error: err,
    });

    logger.error('Error while getting document by userId and docId', err);
  }
};

export default structureText;
