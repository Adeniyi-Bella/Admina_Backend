/**
 * @copyright 2025 Adeniyi Bella
 * @license Apache-2.0
 */

/**
 * Node Modules
 */
import 'reflect-metadata';
import { container } from 'tsyringe';

/**
 * Services and Interfaces
 */
import { IDocumentService } from '@/services/document/document.interface';
import { DocumentService } from '@/services/document/document.service';

/**
 * Models
 */
import Document, { IDocument } from '@/models/document.model';

// Mock the Document model
jest.mock('@/models/document');

describe('DocumentService Unit Tests', () => {
  let documentService: IDocumentService;

  beforeAll(() => {
    // Register DocumentService for DI
    container.register<IDocumentService>('IDocumentService', {
      useClass: DocumentService,
    });
    documentService = container.resolve<IDocumentService>('IDocumentService');
  });

  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  describe('getAllDocumentsByUserId', () => {
    it('should throw an error if userId is empty or invalid', async () => {
      await expect(documentService.getAllDocumentsByUserId('', 10, 0)).rejects.toThrow('Valid userId is required');
      await expect(documentService.getAllDocumentsByUserId(null as any, 10, 0)).rejects.toThrow('Valid userId is required');
      await expect(documentService.getAllDocumentsByUserId(undefined as any, 10, 0)).rejects.toThrow('Valid userId is required');
    });

    it('should return documents and total count for a user', async () => {
      const userId = '12345';
      const mockDocuments = [
        { userId, docId: 'doc1', title: 'Doc 1' },
        { userId, docId: 'doc2', title: 'Doc 2' },
      ];
      (Document.countDocuments as jest.Mock).mockResolvedValue(2);
      (Document.find as jest.Mock).mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(mockDocuments),
      });

      const result = await documentService.getAllDocumentsByUserId(userId, 10, 0);

      expect(result).toEqual({ total: 2, documents: mockDocuments });
      expect(Document.countDocuments).toHaveBeenCalledWith({ userId });
      expect(Document.find).toHaveBeenCalledWith({ userId });
    });
  });

  describe('createDocumentByUserId', () => {
    it('should throw an error if document data is missing or invalid', async () => {
      await expect(documentService.createDocumentByUserId(null as any)).rejects.toThrow('Valid document data is required');
      await expect(documentService.createDocumentByUserId(undefined as any)).rejects.toThrow('Valid document data is required');
      await expect(documentService.createDocumentByUserId({})).rejects.toThrow('Valid document data is required');
    });

    it('should create and return a new document', async () => {
      const documentData = {
        userId: '12345',
        docId: 'unique-doc-id',
        title: 'Test Document',
        originalText: 'Sample text',
      };
      const createdDocument = { ...documentData, _id: 'mongo-id' };
      (Document.create as jest.Mock).mockResolvedValue(createdDocument);
      (Document.findById as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(documentData),
      });

      const result = await documentService.createDocumentByUserId(documentData);

      expect(result).toEqual(documentData);
      expect(Document.create).toHaveBeenCalledWith(documentData);
      expect(Document.findById).toHaveBeenCalledWith('mongo-id');
    });

    it('should throw an error if document retrieval fails', async () => {
      const documentData = { userId: '12345', docId: 'unique-doc-id' };
      (Document.create as jest.Mock).mockResolvedValue({ _id: 'mongo-id' });
      (Document.findById as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(null),
      });

      await expect(documentService.createDocumentByUserId(documentData)).rejects.toThrow('Failed to retrieve created document');
    });
  });

  describe('getDocument', () => {
    it('should throw an error if userId or docId is missing or invalid', async () => {
      await expect(documentService.getDocument('', 'doc1')).rejects.toThrow('Valid userId and docId are required');
      await expect(documentService.getDocument('12345', '')).rejects.toThrow('Valid userId and docId are required');
      await expect(documentService.getDocument(null as any, 'doc1')).rejects.toThrow('Valid userId and docId are required');
      await expect(documentService.getDocument('12345', null as any)).rejects.toThrow('Valid userId and docId are required');
      await expect(documentService.getDocument(undefined as any, 'doc1')).rejects.toThrow('Valid userId and docId are required');
      await expect(documentService.getDocument('12345', undefined as any)).rejects.toThrow('Valid userId and docId are required');
    });

    it('should return a document if found', async () => {
      const userId = '12345';
      const docId = 'doc1';
      const mockDocument = { userId, docId, title: 'Test Document' };
      (Document.findOne as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(mockDocument),
      });

      const result = await documentService.getDocument(userId, docId);

      expect(result).toEqual(mockDocument);
      expect(Document.findOne).toHaveBeenCalledWith({ userId, docId });
    });

    it('should return null if document is not found', async () => {
      (Document.findOne as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(null),
      });

      const result = await documentService.getDocument('12345', 'doc1');

      expect(result).toBeNull();
    });
  });

  describe('deleteDocument', () => {
    it('should throw an error if userId or docId is missing or invalid', async () => {
      await expect(documentService.deleteDocument('', 'doc1')).rejects.toThrow('Valid userId and docId are required');
      await expect(documentService.deleteDocument('12345', '')).rejects.toThrow('Valid userId and docId are required');
      await expect(documentService.deleteDocument(null as any, 'doc1')).rejects.toThrow('Valid userId and docId are required');
      await expect(documentService.deleteDocument('12345', null as any)).rejects.toThrow('Valid userId and docId are required');
      await expect(documentService.deleteDocument(undefined as any, 'doc1')).rejects.toThrow('Valid userId and docId are required');
      await expect(documentService.deleteDocument('12345', undefined as any)).rejects.toThrow('Valid userId and docId are required');
    });

    it('should return true if document is deleted', async () => {
      const userId = '12345';
      const docId = 'doc1';
      (Document.deleteOne as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue({ deletedCount: 1 }),
      });

      const result = await documentService.deleteDocument(userId, docId);

      expect(result).toBe(true);
      expect(Document.deleteOne).toHaveBeenCalledWith({ userId, docId });
    });

    it('should return false if document is not found', async () => {
      const userId = '12345';
      const docId = 'doc1';
      (Document.deleteOne as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue({ deletedCount: 0 }),
      });

      const result = await documentService.deleteDocument(userId, docId);

      expect(result).toBe(false);
    });

    it('should throw an error if deletion fails', async () => {
      const userId = '12345';
      const docId = 'doc1';
      (Document.deleteOne as jest.Mock).mockReturnValue({
        exec: jest.fn().mockRejectedValue(new Error('Database error')),
      });

      await expect(documentService.deleteDocument(userId, docId)).rejects.toThrow('Failed to delete document: Database error');
    });
  });

  describe('updateDocument', () => {
    it('should throw an error if userId or docId is missing or invalid', async () => {
      await expect(documentService.updateDocument('', 'doc1', { title: 'Updated' })).rejects.toThrow('Valid userId and docId are required');
      await expect(documentService.updateDocument('12345', '', { title: 'Updated' })).rejects.toThrow('Valid userId and docId are required');
      await expect(documentService.updateDocument(null as any, 'doc1', { title: 'Updated' })).rejects.toThrow('Valid userId and docId are required');
      await expect(documentService.updateDocument('12345', null as any, { title: 'Updated' })).rejects.toThrow('Valid userId and docId are required');
      await expect(documentService.updateDocument(undefined as any, 'doc1', { title: 'Updated' })).rejects.toThrow('Valid userId and docId are required');
      await expect(documentService.updateDocument('12345', undefined as any, { title: 'Updated' })).rejects.toThrow('Valid userId and docId are required');
    });

    it('should throw an error if updates are empty or null', async () => {
      await expect(documentService.updateDocument('12345', 'doc1', {})).rejects.toThrow('Valid update data is required');
      await expect(documentService.updateDocument('12345', 'doc1', null as any)).rejects.toThrow('Valid update data is required');
      await expect(documentService.updateDocument('12345', 'doc1', undefined as any)).rejects.toThrow('Valid update data is required');
    });

    // it('should update and return the document with new title', async () => {
    //   const userId = '12345';
    //   const docId = 'doc1';
    //   const mockDocument = { userId, docId, title: 'Updated Title', originalText: 'Sample text' };
    //   (Document.findOneAndUpdate as jest.Mock).mockReturnValue({
    //     select: jest.fn().mockReturnThis(),
    //     lean: jest.fn().mockReturnThis(),
    //     exec: jest.fn().mockResolvedValue(mockDocument),
    //   });

    //   const updates: Partial<IDocument> = { title: 'Updated Title' };
    //   const result = await documentService.updateDocument(userId, docId, updates);

    //   expect(result).toEqual(mockDocument);
    //   expect(Document.findOneAndUpdate).toHaveBeenCalledWith(
    //     { userId, docId },
    //     { $set: updates },
    //     { new: true, runValidators: true, select: '-__v' }
    //   );
    // });

    // it('should update and return the document with updated actionPlans.completed', async () => {
    //   const userId = '12345';
    //   const docId = 'doc1';
    //   const actionPlanId = 'action-plan-1';
    //   const mockDocument = {
    //     userId,
    //     docId,
    //     title: 'Test Document',
    //     originalText: 'Sample text',
    //     actionPlans: [
    //       { id: actionPlanId, title: 'Action 1', dueDate: new Date('2025-08-01'), completed: true, location: 'Office' },
    //     ],
    //   };
    //   (Document.findOneAndUpdate as jest.Mock).mockReturnValue({
    //     select: jest.fn().mockReturnThis(),
    //     lean: jest.fn().mockReturnThis(),
    //     exec: jest.fn().mockResolvedValue(mockDocument),
    //   });

    //   const updates: Partial<IDocument> = {
    //     actionPlans: [
    //       { id: actionPlanId, title: 'Action 1', dueDate: new Date('2025-08-01'), completed: true, location: 'Office' },
    //     ],
    //   };
    //   const result = await documentService.updateDocument(userId, docId, updates);

    //   expect(result).toEqual(mockDocument);
    //   expect(result?.actionPlans?.[0].completed).toBe(true);
    //   expect(Document.findOneAndUpdate).toHaveBeenCalledWith(
    //     { userId, docId },
    //     { $set: updates },
    //     { new: true, runValidators: true, select: '-__v' }
    //   );
    // });

    it('should return null if document is not found', async () => {
      (Document.findOneAndUpdate as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(null),
      });

      const updates: Partial<IDocument> = { title: 'Updated Title' };
      const result = await documentService.updateDocument('12345', 'doc1', updates);

      expect(result).toBeNull();
    });

    it('should throw an error if update fails due to database error', async () => {
      (Document.findOneAndUpdate as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockRejectedValue(new Error('Database error')),
      });

      const updates: Partial<IDocument> = { title: 'Updated Title' };
      await expect(documentService.updateDocument('12345', 'doc1', updates)).rejects.toThrow('Failed to update document: Database error');
    });
  });
});