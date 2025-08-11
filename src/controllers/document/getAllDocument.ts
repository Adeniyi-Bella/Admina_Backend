/**
 * @copyright 2025 Adeniyi Bella
 * @license Apache-2.0
 */

/**
 * Custom modules
 */
import config from '@/config';
import { logger } from '@/lib/winston';

/**
 * Node modules
 */
import { container } from 'tsyringe';

/**
 * Interfaces
 */
import { IDocumentService } from '@/services/document/document.interface';

/**
 * Types
 */
import type { Request, Response } from 'express';
import { ApiResponse } from '@/lib/api_response';

const getAllDocuments = async (req: Request, res: Response): Promise<void> => {
    const documentService = container.resolve<IDocumentService>('IDocumentService');
  try {
    const limit = parseInt(req.query.limit as string) || config.defaultResLimit;
    const offset =
      parseInt(req.query.offset as string) || config.defaultResOffset;

      const {total, documents} =await documentService.getAllDocumentsByUserId(req.userId!, limit, offset)

    res.status(200).json({
      limit,
      offset,
      total,
      documents,
    });
  }  catch (error: unknown) {
    logger.error('Error getting all documents', error);
    // Check if error is an instance of Error to safely access message
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    ApiResponse.serverError(res, 'Internal server error', errorMessage);
  }
};

export default getAllDocuments;
