/**
 * @copyright 2025 Adeniyi Bella
 * @license Apache-2.0
 */

/**
 * Node modules
 */
import "reflect-metadata"
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { container } from 'tsyringe';

/**
 * Services and Interfaces
 */
import { IDocumentService } from '@/services/document/document.interface';
import { DocumentService } from '@/services/document/document.service';

/**
 * Models
 */
import Document, { IDocument } from '@/models/document';

// Register DocumentService for DI
container.register<IDocumentService>('IDocumentService', { useClass: DocumentService });

describe('DocumentService Integration Tests', () => {
  let mongoServer: MongoMemoryServer;
  let documentService: IDocumentService;

  beforeAll(async () => {
    // Start in-memory MongoDB
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    await mongoose.connect(uri);

    // Resolve DocumentService from container
    documentService = container.resolve<IDocumentService>('IDocumentService');
  });

  afterEach(async () => {
    // Clear database after each test
    await Document.deleteMany({});
  });

  afterAll(async () => {
    // Clean up
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  describe('getAllDocumentsByUserId', () => {
    it('should throw an error if userId is empty', async () => {
      await expect(documentService.getAllDocumentsByUserId('', 10, 0)).rejects.toThrow('Valid userId is required');
    });

    it('should return empty documents and total count for a user with no documents', async () => {
      const result = await documentService.getAllDocumentsByUserId('12345', 10, 0);

      expect(result).toEqual({ total: 0, documents: [] });
    });

    it('should return documents and total count for a user with pagination', async () => {
      const userId = '12345';
      await Document.create([
        { userId, docId: 'doc1', title: 'Doc 1', originalText: 'Text 1' },
        { userId, docId: 'doc2', title: 'Doc 2', originalText: 'Text 2' },
      ]);

      const result = await documentService.getAllDocumentsByUserId(userId, 1, 0);

      expect(result.total).toBe(2);
      expect(result.documents).toHaveLength(1);
      expect(result.documents[0].docId).toBe('doc1');
    });
  });

  describe('createDocumentByUserId', () => {
    it('should throw an error if document data is missing', async () => {
      await expect(documentService.createDocumentByUserId(null as any)).rejects.toThrow('Valid document data is required');
    });

    it('should create and return a new document', async () => {
      const documentData: Partial<IDocument> = {
        userId: '12345',
        docId: 'unique-doc-id',
        title: 'Test Document',
        originalText: 'Sample text',
      };

      const result = await documentService.createDocumentByUserId(documentData);

      expect(result.userId).toBe(documentData.userId);
      expect(result.docId).toBe(documentData.docId);
      expect(result.title).toBe(documentData.title);

      // Verify document exists in database
      const savedDocument = await Document.findOne({ docId: 'unique-doc-id' });
      expect(savedDocument).toBeDefined();
      expect(savedDocument?.title).toBe('Test Document');
    });
  });

  describe('getDocument', () => {
    it('should throw an error if userId or docId is missing', async () => {
      await expect(documentService.getDocument('', 'doc1')).rejects.toThrow('Valid userId and docId are required');
      await expect(documentService.getDocument('12345', '')).rejects.toThrow('Valid userId and docId are required');
    });

    it('should return a document if found', async () => {
      const userId = '12345';
      const docId = 'doc1';
      await Document.create({ userId, docId, title: 'Test Document', originalText: 'Sample text' });

      const result = await documentService.getDocument(userId, docId);

      expect(result).toBeDefined();
      expect(result?.docId).toBe(docId);
      expect(result?.title).toBe('Test Document');
    });

    it('should return null if document is not found', async () => {
      const result = await documentService.getDocument('12345', 'nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('deleteDocument', () => {
    it('should throw an error if userId or docId is missing', async () => {
      await expect(documentService.deleteDocument('', 'doc1')).rejects.toThrow('Valid userId and docId are required');
      await expect(documentService.deleteDocument('12345', '')).rejects.toThrow('Valid userId and docId are required');
    });

    it('should return true if document is deleted', async () => {
      const userId = '12345';
      const docId = 'doc1';
      await Document.create({ userId, docId, title: 'Test Document', originalText: 'Sample text' });

      const result = await documentService.deleteDocument(userId, docId);

      expect(result).toBe(true);

      // Verify document was deleted
      const document = await Document.findOne({ userId, docId });
      expect(document).toBeNull();
    });

    it('should return false if document is not found', async () => {
      const result = await documentService.deleteDocument('12345', 'nonexistent');

      expect(result).toBe(false);
    });
  });
});