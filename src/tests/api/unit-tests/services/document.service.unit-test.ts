import 'reflect-metadata';
import Document from '@/models/document.model';
import { logger } from '@/lib/winston';
import { DocumentService } from '@/services/document/document.service';

// Mock all Document model methods
jest.mock('@/models/document.model', () => ({
  deleteMany: jest.fn(),
  countDocuments: jest.fn(),
  find: jest.fn(),
  create: jest.fn(),
  findById: jest.fn(),
  findOne: jest.fn(),
  deleteOne: jest.fn(),
  findOneAndUpdate: jest.fn(),
}));

jest.mock('@/lib/winston', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
  },
}));

describe('DocumentService', () => {
  let service: DocumentService;
  const userId = 'user123';
  const docId = 'doc123';

  beforeEach(() => {
    service = new DocumentService();
    jest.clearAllMocks();
  });

  describe('deleteAllDocuments', () => {
    it('should delete all documents successfully', async () => {
      (Document.deleteMany as jest.Mock).mockReturnValue({ exec: () => Promise.resolve({ deletedCount: 2 }) });

      const result = await service.deleteAllDocuments(userId);

      expect(result).toBe(true);
      expect(logger.info).toHaveBeenCalledWith('All documents deleted successfully', {
        userId,
        deletedCount: 2,
      });
    });

    it('should log info if no documents found', async () => {
      (Document.deleteMany as jest.Mock).mockReturnValue({ exec: () => Promise.resolve({ deletedCount: 0 }) });

      await service.deleteAllDocuments(userId);

      expect(logger.info).toHaveBeenCalledWith('No documents found for deletion', { userId });
    });

    it('should throw error if deletion fails', async () => {
      (Document.deleteMany as jest.Mock).mockReturnValue({ exec: () => Promise.reject(new Error('DB error')) });

      await expect(service.deleteAllDocuments(userId)).rejects.toThrow('Failed to delete all documents: DB error');
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('getAllDocumentsByUserId', () => {
    it('should throw error if userId is missing', async () => {
      await expect(service.getAllDocumentsByUserId('', 10, 0)).rejects.toThrow('Valid userId is required');
    });

    it('should return documents with total count', async () => {
      (Document.countDocuments as jest.Mock).mockResolvedValue(5);
      (Document.find as jest.Mock).mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([{ docId }]),
      });

      const result = await service.getAllDocumentsByUserId(userId, 10, 0);

      expect(result.total).toBe(5);
      expect(result.documents).toEqual([{ docId }]);
    });
  });

  describe('createDocumentByUserId', () => {
    it('should throw if document data is invalid', async () => {
      await expect(service.createDocumentByUserId({})).rejects.toThrow('Valid document data is required');
    });

    it('should create and return a document', async () => {
      const mockDoc = { _id: 'id123' };
      (Document.create as jest.Mock).mockResolvedValue(mockDoc);
      (Document.findById as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue({ docId }),
      });

      const result = await service.createDocumentByUserId({ userId, docId });

      expect(result).toEqual({ docId });
      expect(logger.info).toHaveBeenCalledWith('Document created successfully');
    });

    it('should throw if findById returns null', async () => {
      const mockDoc = { _id: 'id123' };
      (Document.create as jest.Mock).mockResolvedValue(mockDoc);
      (Document.findById as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(null),
      });

      await expect(service.createDocumentByUserId({ userId, docId })).rejects.toThrow(
        'Failed to retrieve created document'
      );
    });
  });

  describe('getDocument', () => {
    it('should throw if userId or docId is missing', async () => {
      await expect(service.getDocument('', docId)).rejects.toThrow('Valid userId and docId are required');
    });

    it('should return document if found', async () => {
      (Document.findOne as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue({ docId }),
      });

      const result = await service.getDocument(userId, docId);
      expect(result).toEqual({ docId });
    });

    it('should throw if not found', async () => {
      (Document.findOne as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(null),
      });

      await expect(service.getDocument(userId, docId)).rejects.toThrow('Document not found');
    });
  });

  describe('deleteDocument', () => {
    it('should throw if userId or docId is missing', async () => {
      await expect(service.deleteDocument('', docId)).rejects.toThrow('Valid userId and docId are required');
    });

    it('should delete document successfully', async () => {
      (Document.deleteOne as jest.Mock).mockReturnValue({ exec: () => Promise.resolve({ deletedCount: 1 }) });

      const result = await service.deleteDocument(userId, docId);
      expect(result).toBe(true);
    });

    it('should return false if no document found', async () => {
      (Document.deleteOne as jest.Mock).mockReturnValue({ exec: () => Promise.resolve({ deletedCount: 0 }) });

      const result = await service.deleteDocument(userId, docId);
      expect(result).toBe(false);
    });
  });

  describe('updateDocument', () => {
    it('should throw if userId/docId missing', async () => {
      await expect(service.updateDocument('', docId, {})).rejects.toThrow('Valid userId and docId are required');
    });

    it('should throw if updates missing', async () => {
      await expect(service.updateDocument(userId, docId, {})).rejects.toThrow('Valid update data is required');
    });

    it('should return updated document', async () => {
      (Document.findOneAndUpdate as jest.Mock).mockReturnValue({
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue({ docId }),
      });

      const result = await service.updateDocument(userId, docId, { title: 'new' });
      expect(result).toEqual({ docId });
    });

    it('should return null if not found', async () => {
      (Document.findOneAndUpdate as jest.Mock).mockReturnValue({
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(null),
      });

      const result = await service.updateDocument(userId, docId, { title: 'new' });
      expect(result).toBeNull();
    });
  });

  describe('updateActionPlan', () => {
    it('should throw if userId/docId missing', async () => {
      await expect(service.updateActionPlan('', docId, 'create')).rejects.toThrow(
        'Valid userId and docId are required'
      );
    });

    it('should create action plan', async () => {
      (Document.findOneAndUpdate as jest.Mock).mockReturnValue({
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue({ docId }),
      });

      const result = await service.updateActionPlan(userId, docId, 'create', { title: 'Test' });
      expect(result).toEqual({ docId });
    });

    it('should delete action plan', async () => {
      (Document.findOne as jest.Mock).mockReturnValue({ exec: jest.fn().mockResolvedValue({}) });
      (Document.findOneAndUpdate as jest.Mock).mockReturnValue({
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue({ docId }),
      });

      const result = await service.updateActionPlan(userId, docId, 'delete', undefined, 'ap1');
      expect(result).toEqual({ docId });
    });

    it('should update action plan', async () => {
      (Document.findOne as jest.Mock).mockReturnValue({ exec: jest.fn().mockResolvedValue({}) });
      (Document.findOneAndUpdate as jest.Mock).mockReturnValue({
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue({ docId }),
      });

      const result = await service.updateActionPlan(userId, docId, 'update', { title: 'new' }, 'ap1');
      expect(result).toEqual({ docId });
    });

    it('should throw on invalid action', async () => {
      await expect(service.updateActionPlan(userId, docId, 'invalid' as any)).rejects.toThrow(
        'Invalid action type. Must be "create", "delete", or "update"'
      );
    });
  });
});
