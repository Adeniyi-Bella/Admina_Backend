/**
 * @copyright 2025 Adeniyi Bella
 * @license Apache-2.0
 */

/**
 * Types
 */
import { IDocument } from '@/models/document';

export interface IDocumentService {
  getAllDocumentsByUserId(userId: string, limit: number, offset: number): Promise<{total: number, documents: IDocument[]}>;
  createDocumentByUserId(document: Partial<IDocument>): Promise<IDocument>;
  getDocument(userId: string, docId: string): Promise<IDocument | null>
  deleteDocument(userId: string, docId: string): Promise<boolean>;
}
