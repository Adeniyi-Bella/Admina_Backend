/**
 * @copyright 2025 Adeniyi Bella
 * @license Apache-2.0
 */

/**
 * Custom modules
 */
import { logger } from '@/lib/winston';

/**
 * Interfaces
 */
import { IDocumentService } from '@/services/document/document.interface';

/**
 * Node modules
 */
import { container } from 'tsyringe';

/**
 * Types
 */
import type { Request, Response } from 'express';

const deleteDocument = async (req: Request, res: Response): Promise<void> => {
  const documentService = container.resolve<IDocumentService>('IDocumentService');

  try {
    const userId = req.userId;
    const docId = req.params.docId;

    const deleted = await documentService.deleteDocument(userId, docId);

    if (!deleted) {
      res.status(404).json({ code: 'NotFound', message: 'Document not found' });
      return;
    }

    res.status(200).json({ message: 'Document deleted successfully' });
  } catch (error) {
    logger.error('Error deleting document', error);
    res.status(500).json({
      code: 'ServerError',
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

export default deleteDocument;