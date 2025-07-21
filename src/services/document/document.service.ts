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
import { v4 as uuidv4 } from 'uuid';

/**
 * Custom modules
 */
import { logger } from '@/lib/winston';

/**
 * Types
 */
import { Types } from 'mongoose';

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

      // Generate docId if not provided
      const docId = document.docId || uuidv4();

      // Prepare document data
      const documentData: IDocument = {
        userId: document.userId!,
        docId,
        title: document.title || '',
        sender: document.sender || '',
        receivedDate: document.receivedDate || new Date(),
        summary: document.summary || '',
        originalText: document.originalText || '',
        translatedText: document.translatedText || '',
        sourceLanguage: document.sourceLanguage || '',
        targetLanguage: document.targetLanguage || '',
        actionPlan: document.actionPlan || [],
        actionPlans: (document.actionPlans || []).map((plan) => ({
          id: plan.id || uuidv4(),
          title: plan.title || '',
          dueDate: plan.dueDate || new Date(),
          completed: plan.completed ?? false,
          location: plan.location || '',
        })),
      };

      // Create and save the document
      const createdDocument = await Document.create(documentData);

      // Convert to plain object and remove __v
      const result = await Document.findById(createdDocument._id)
        .select('-__v')
        .lean()
        .exec();

      if (!result) {
        throw new Error('Failed to retrieve created document');
      }

      logger.info('Document created successfully', { docId });

      return result as IDocument;
    } catch (error) {
      logger.error('Failed to create document', { error: error });
      throw new Error(`Failed to create document: ${error}`);
    }
  }

  async getDocument(userId: string, docId: string): Promise<IDocument | null> {
      return await Document.findOne({ userId, docId }).select('-__v').exec()
  }
}