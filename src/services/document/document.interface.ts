/**
 * @copyright 2025 Adeniyi Bella
 * @license Apache-2.0
 */

/**
 * Types
 */
import { IActionPlan, IDocument } from '@/models/document.model';

export interface IDocumentService {
  getAllDocumentsByUserId(
    userId: string,
    limit: number,
    offset: number,
  ): Promise<{ total: number; documents: IDocument[] }>;

  createDocumentByUserId(document: Partial<IDocument>): Promise<IDocument>;

  getDocument(userId: string, docId: string): Promise<IDocument | null>;

  deleteDocument(userId: string, docId: string): Promise<boolean>;

  updateDocument(
    userId: string,
    docId: string,
    updates: Partial<IDocument> | { $inc?: any },
  ): Promise<IDocument | null>;

  updateActionPlan(
    userId: string,
    docId: string,
    action: 'create' | 'delete' | 'update',
    actionPlanData?: Partial<IActionPlan>,
    actionPlanId?: string,
  ): Promise<IDocument | null>;
  
  deleteAllDocuments(userId: string): Promise<boolean>;
}
