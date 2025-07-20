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
 * Types
 */
import { Types } from 'mongoose';


@injectable()
export class DocumentService implements IDocumentService {
  async getAllDocumentsByUserId(
    userId: Types.ObjectId | undefined,
    limit: number,
    offset: number,
  ): Promise<{ total: number; documents:  IDocument[] }> {
    const total = await Document.countDocuments({ userId });

    const documents = await Document.find({ userId })
      .select('-__v')
      .limit(limit)
      .skip(offset)
      .lean()
      .exec();

    return { total, documents };
  }
}
