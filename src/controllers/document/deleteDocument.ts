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
import { ApiResponse } from '@/lib/api_response';

const deleteDocument = async (req: Request, res: Response): Promise<void> => {
  const documentService = container.resolve<IDocumentService>('IDocumentService');

  try {
    const userId = req.userId;
    const docId = req.params.docId;

    const deleted = await documentService.deleteDocument(userId, docId);

    if (!deleted) {
      ApiResponse.notFound(res, 'Document not found');
      return;
    }

    ApiResponse.ok(res, 'Document deleted successfully');
  } catch (error: unknown) {
    logger.error('Error deleting document', error);
    // Check if error is an instance of Error to safely access message
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    ApiResponse.serverError(res, 'Internal server error', errorMessage);
  }
};

export default deleteDocument;