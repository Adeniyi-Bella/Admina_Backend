import { logger } from '@/lib/winston';
import { IDocumentService } from '@/services/document/document.interface';
import type { Request, Response } from 'express';
import { container } from 'tsyringe';

const getDocument = async (req: Request, res: Response): Promise<void> => {
  const documentService =
    container.resolve<IDocumentService>('IDocumentService');

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

    res.status(200).json({ document });
  } catch (err) {
    res.status(500).json({
      code: 'ServerError',
      message: 'Internal server error',
      error: err,
    });

    logger.error('Error while getting document by userId and docId', err);
  }
};

export default getDocument;
