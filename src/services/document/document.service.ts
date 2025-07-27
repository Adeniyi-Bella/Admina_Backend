/**
 * @copyright 2025 Adeniyi Bella
 * @license Apache-2.0
 */

/**
 * Models
 */
import Document, { IDocument } from '@/models/document';

/**
 * Interfaces
 */
import { IDocumentService } from './document.interface';

/**
 * Node modules
 */
import { injectable } from 'tsyringe';

/**
 * Custom modules
 */
import { logger } from '@/lib/winston';

@injectable()
export class DocumentService implements IDocumentService {
  /**
   * Retrieves all documents for a user with pagination.
   * @param userId - The ID of the user.
   * @param limit - Number of documents to return.
   * @param offset - Number of documents to skip.
   * @returns An object containing the total count and the documents.
   */
  async getAllDocumentsByUserId(
    userId: string,
    limit: number,
    offset: number,
  ): Promise<{ total: number; documents: IDocument[] }> {
    if (!userId) {
      throw new Error('Valid userId is required');
    }

    const total = await Document.countDocuments({ userId });

    const documents = await Document.find({ userId })
      .select('-__v')
      .limit(limit)
      .skip(offset)
      .lean()
      .exec();

    return { total, documents };
  }

  /**
   * Creates a new document for a user and returns the created document.
   * @param userId - The ID of the user.
   * @param document - The document data to create.
   * @returns The created document.
   * @throws Error if creation fails or required fields are missing.
   */
  async createDocumentByUserId(
    document: Partial<IDocument>
  ): Promise<IDocument> {
    try {
     
      if (!document) {
        throw new Error('Valid document data is required');
      }

      // Create and save the document
      const createdDocument = await Document.create(document);

      // Convert to plain object and remove __v
      const result = await Document.findById(createdDocument._id)
        .select('-__v')
        .lean()
        .exec();

      if (!result) {
        throw new Error('Failed to retrieve created document');
      }

      logger.info('Document created successfully', result);

      return result as IDocument;
    } catch (error) {
      logger.error('Failed to create document', { error: error });
      throw new Error(`Failed to create document: ${error}`);
    }
  }

  /**
   * Retrieves a document by userId and docId.
   * @param userId - The ID of the user.
   * @param docId - The ID of the document.
   * @returns The document if found, null otherwise.
   */
  async getDocument(userId: string, docId: string): Promise<IDocument | null> {
    if (!userId || !docId) {
        throw new Error('Valid userId and docId are required');
      }
      return await Document.findOne({ userId, docId }).select('-__v').exec()
  }

  /**
   * Deletes a document by userId and docId.
   * @param userId - The ID of the user.
   * @param docId - The ID of the document.
   * @returns True if the document was deleted, false if not found.
   * @throws Error if deletion fails.
   */
  async deleteDocument(userId: string, docId: string): Promise<boolean> {
    try {
      if (!userId || !docId) {
        throw new Error('Valid userId and docId are required');
      }

      const result = await Document.deleteOne({ userId, docId }).exec();

      if (result.deletedCount === 0) {
        logger.info('Document not found for deletion', { userId, docId });
        return false;
      }

      logger.info('Document deleted successfully', { userId, docId });
      return true;
    } catch (error) {
      logger.error('Failed to delete document', { userId, docId, error });
      throw new Error(`Failed to delete document: ${error instanceof Error ? error.message : error}`);
    }
  }
}