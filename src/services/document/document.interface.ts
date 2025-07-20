/**
 * @copyright 2025 Adeniyi Bella
 * @license Apache-2.0
 */

/**
 * Types
 */
import { IDocument } from '@/models/document';
import { Types } from 'mongoose';

export interface IDocumentService {
  getAllDocumentsByUserId(userId: Types.ObjectId | undefined, limit: number, offset: number): Promise<{total: number, documents: IDocument[]}>;
  createDocumentByUserId(document: IDocument): Promise<IDocument>;
}
