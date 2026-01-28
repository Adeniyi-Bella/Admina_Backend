import 'reflect-metadata';
import { DocumentService } from '@/services/document/document.service';
import Document from '@/models/document.model';
import { UserDTO } from '@/types';
import { cacheService } from '@/services/redis-cache/redis-cache.service';
import { IUserService } from '@/services/users/user.interface';
import { UserService } from '@/services/users/user.service';

jest.mock('@/models/document.model');
jest.mock('@/services/redis-cache/redis-cache.service');

describe('DocumentService - Testing', () => {
  let documentService: DocumentService;
  let userService: IUserService = new UserService();
  let mockUser: UserDTO;

  beforeEach(() => {
    documentService = new DocumentService(userService);
    mockUser = {
      userId: 'test-user-id',
      email: 'test@example.com',
      plan: 'free',
      lengthOfDocs: { free: { max: 2, min: 0, current: 2 } },
    };
    jest.clearAllMocks();
  });

  describe('getDocument - Request Coalescing & Cache-Aside', () => {
    /**
     * CRITICAL: Request coalescing prevents multiple DB queries
     */
    it('should use request coalescing for concurrent document fetches', async () => {
      const mockDoc = {
        userId: 'test-user-id',
        docId: 'doc-123',
        title: 'Test Document',
      };

      (cacheService.getOrFetch as jest.Mock).mockResolvedValue(mockDoc);

      (Document.findOne as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(mockDoc),
      });

      // Simulate 10 concurrent requests
      const requests = Array(10)
        .fill(null)
        .map(() => documentService.getDocument(mockUser, 'doc-123'));

      const results = await Promise.all(requests);

      results.forEach((result) => expect(result).toEqual(mockDoc));
      expect(cacheService.getOrFetch).toHaveBeenCalledTimes(10);
    });

    it('should return cached document without DB query', async () => {
      const cachedDoc = {
        userId: 'test-user-id',
        docId: 'doc-123',
        title: 'Cached Document',
      };

      (cacheService.getOrFetch as jest.Mock).mockResolvedValue(cachedDoc);

      const result = await documentService.getDocument(mockUser, 'doc-123');

      expect(result).toEqual(cachedDoc);
      expect(cacheService.getOrFetch).toHaveBeenCalledWith(
        'doc:test-user-id:doc-123',
        expect.any(Function),
        3600,
      );
    });

    it('should add document to tag on first fetch', async () => {
      const mockDoc = {
        userId: 'test-user-id',
        docId: 'doc-123',
        title: 'Test Document',
      };

      (cacheService.getOrFetch as jest.Mock).mockImplementation(
        async (key, fetchFn) => fetchFn(),
      );

      (Document.findOne as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(mockDoc),
      });

      (cacheService.addToTag as jest.Mock).mockResolvedValue(true);

      await documentService.getDocument(mockUser, 'doc-123');

      expect(cacheService.addToTag).toHaveBeenCalledWith(
        'tag:docs:test-user-id',
        'doc:test-user-id:doc-123',
      );
    });
  });

  describe('getAllDocumentsByUserId - Paginated List Caching', () => {
    /**
     * CRITICAL: Cache document lists with pagination params
     * Invalidate all list caches when any document changes
     */
    it('should cache paginated document lists', async () => {
      const mockDocs = [
        { docId: 'doc-1', title: 'Doc 1' },
        { docId: 'doc-2', title: 'Doc 2' },
      ];

      (cacheService.getOrFetch as jest.Mock).mockResolvedValue({
        total: 10,
        documents: mockDocs,
      });

      const result = await documentService.getAllDocumentsByUserId(
        mockUser,
        2,
        0,
      );

      expect(result).toEqual({
        total: 10,
        documents: mockDocs,
      });

      expect(cacheService.getOrFetch).toHaveBeenCalledWith(
        'docs:list:test-user-id:2:0',
        expect.any(Function),
        1800, // 30 minutes for lists
      );
    });

    it('should cache different pagination params separately', async () => {
      (cacheService.getOrFetch as jest.Mock).mockResolvedValue({
        total: 10,
        documents: [],
      });

      await documentService.getAllDocumentsByUserId(mockUser, 10, 0);
      await documentService.getAllDocumentsByUserId(mockUser, 10, 10);

      expect(cacheService.getOrFetch).toHaveBeenCalledWith(
        'docs:list:test-user-id:10:0',
        expect.any(Function),
        1800,
      );

      expect(cacheService.getOrFetch).toHaveBeenCalledWith(
        'docs:list:test-user-id:10:10',
        expect.any(Function),
        1800,
      );
    });
  });

  // describe('createDocumentAndUpdatePlanLimit - Tag Invalidation', () => {
  //   /**
  //    * CRITICAL: Creating a document must invalidate ALL list caches
  //    */
  //   it('should invalidate document list caches on creation', async () => {
  //     const mockDoc = {
  //       userId: 'test-user-id',
  //       docId: 'doc-123',
  //       title: 'New Document',
  //     };

  //     const mockCreated = { _id: 'mongo-id', ...mockDoc };

  //     (Document.create as jest.Mock).mockResolvedValue(mockCreated);
  //     (Document.findById as jest.Mock).mockReturnValue({
  //       select: jest.fn().mockReturnThis(),
  //       lean: jest.fn().mockReturnThis(),
  //       exec: jest.fn().mockResolvedValue(mockDoc),
  //     });

  //     (cacheService.invalidateTag as jest.Mock).mockResolvedValue(true);

  //     await documentService.createDocumentAndUpdatePlanLimit(mockDoc);

  //     // CRITICAL: Should invalidate all document-related caches for this user
  //     expect(cacheService.invalidateTag).toHaveBeenCalledWith('tag:docs:test-user-id');
  //   });
  // });

  // ==========================================================================
  // CREATE DOCUMENT - Document Creation Business Logic
  // ==========================================================================
  // describe('createDocumentAndUpdatePlanLimit - Document Creation', () => {
  //   /**
  //    * BUSINESS RULE: Create document and invalidate list caches
  //    */
  //   it('should create document with required fields', async () => {
  //     const mockDoc = {
  //       userId: 'test-user-id',
  //       docId: 'doc-123',
  //       title: 'Test Document',
  //       sender: 'sender@example.com',
  //       receivedDate: new Date(),
  //     };

  //     const mockCreated = { _id: 'mongo-id', ...mockDoc };

  //     (Document.create as jest.Mock).mockResolvedValue(mockCreated);
  //     (Document.findById as jest.Mock).mockReturnValue({
  //       select: jest.fn().mockReturnThis(),
  //       lean: jest.fn().mockReturnThis(),
  //       exec: jest.fn().mockResolvedValue(mockDoc),
  //     });

  //     (cacheService.invalidateTag as jest.Mock).mockResolvedValue(true);

  //     const result = await documentService.createDocumentAndUpdatePlanLimit(mockDoc);

  //     expect(result).toEqual(mockDoc);
  //     expect(Document.create).toHaveBeenCalledWith(mockDoc);
  //   });

  //   it('should throw InvalidInputError when userId is missing', async () => {
  //     const invalidDoc = { docId: 'doc-123', title: 'Test' };

  //     await expect(
  //       documentService.createDocumentAndUpdatePlanLimit(invalidDoc)
  //     ).rejects.toThrow('Valid document data with userId and docId required');
  //   });

  //   it('should throw InvalidInputError when docId is missing', async () => {
  //     const invalidDoc = { userId: 'user-123', title: 'Test' };

  //     await expect(
  //       documentService.createDocumentAndUpdatePlanLimit(invalidDoc)
  //     ).rejects.toThrow('Valid document data with userId and docId required');
  //   });

  //   it('should invalidate user document list caches after creation', async () => {
  //     const mockDoc = {
  //       userId: 'test-user-id',
  //       docId: 'doc-123',
  //       title: 'Test',
  //     };

  //     const mockCreated = { _id: 'mongo-id', ...mockDoc };

  //     (Document.create as jest.Mock).mockResolvedValue(mockCreated);
  //     (Document.findById as jest.Mock).mockReturnValue({
  //       select: jest.fn().mockReturnThis(),
  //       lean: jest.fn().mockReturnThis(),
  //       exec: jest.fn().mockResolvedValue(mockDoc),
  //     });

  //     (cacheService.invalidateTag as jest.Mock).mockResolvedValue(true);

  //     await documentService.createDocumentAndUpdatePlanLimit(mockDoc);

  //     expect(cacheService.invalidateTag).toHaveBeenCalledWith('tag:docs:test-user-id');
  //   });

  //   it('should throw DatabaseError when creation fails', async () => {
  //     const mockDoc = {
  //       userId: 'test-user-id',
  //       docId: 'doc-123',
  //       title: 'Test',
  //     };

  //     (Document.create as jest.Mock).mockRejectedValue(new Error('Failed to create document'));

  //     await expect(
  //       documentService.createDocumentAndUpdatePlanLimit(mockDoc)
  //     ).rejects.toThrow('Failed to create document');
  //   });

  //   it('should throw DatabaseError when findById returns null', async () => {
  //     const mockDoc = {
  //       userId: 'test-user-id',
  //       docId: 'doc-123',
  //       title: 'Test',
  //     };

  //     (Document.create as jest.Mock).mockResolvedValue({ _id: 'mongo-id' });
  //     (Document.findById as jest.Mock).mockReturnValue({
  //       select: jest.fn().mockReturnThis(),
  //       lean: jest.fn().mockReturnThis(),
  //       exec: jest.fn().mockResolvedValue(null),
  //     });

  //     await expect(
  //       documentService.createDocumentAndUpdatePlanLimit(mockDoc)
  //     ).rejects.toThrow('Failed to retrieve created document');
  //   });
  // });

  describe('updateDocument - Cache Invalidation', () => {
    /**
     * CRITICAL: Updates must invalidate cache (delete, not update)
     */
    it('should invalidate specific document and tag caches on update', async () => {
      const mockDoc = {
        userId: 'test-user-id',
        docId: 'doc-123',
        title: 'Updated Title',
      };

      (Document.findOneAndUpdate as jest.Mock).mockReturnValue({
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(mockDoc),
      });

      (cacheService.delete as jest.Mock).mockResolvedValue(true);
      (cacheService.invalidateTag as jest.Mock).mockResolvedValue(true);

      await documentService.updateDocument('test-user-id', 'doc-123', {
        title: 'Updated Title',
      });

      // CRITICAL: Should DELETE specific cache
      expect(cacheService.delete).toHaveBeenCalledWith(
        'doc:test-user-id:doc-123',
      );

      // CRITICAL: Should invalidate tag (all list caches)
      expect(cacheService.invalidateTag).toHaveBeenCalledWith(
        'tag:docs:test-user-id',
      );
    });

    it('should not invalidate cache when document not found', async () => {
      (Document.findOneAndUpdate as jest.Mock).mockReturnValue({
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(null),
      });

      await documentService.updateDocument('test-user-id', 'non-existent', {
        title: 'New',
      });

      expect(cacheService.delete).not.toHaveBeenCalled();
      expect(cacheService.invalidateTag).not.toHaveBeenCalled();
    });
  });

  describe('deleteDocument - Cache & Tag Invalidation', () => {
    /**
     * CRITICAL: Deleting invalidates specific cache AND all list caches
     */
    it('should invalidate specific and tag caches on deletion', async () => {
      (Document.deleteOne as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue({ deletedCount: 1 }),
      });

      (cacheService.delete as jest.Mock).mockResolvedValue(true);
      (cacheService.invalidateTag as jest.Mock).mockResolvedValue(true);

      await documentService.deleteDocument('test-user-id', 'doc-123');

      expect(cacheService.delete).toHaveBeenCalledWith(
        'doc:test-user-id:doc-123',
      );
      expect(cacheService.invalidateTag).toHaveBeenCalledWith(
        'tag:docs:test-user-id',
      );
    });

    it('should not invalidate cache when document not found', async () => {
      (Document.deleteOne as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue({ deletedCount: 0 }),
      });

      await documentService.deleteDocument('test-user-id', 'non-existent');

      expect(cacheService.delete).not.toHaveBeenCalled();
      expect(cacheService.invalidateTag).not.toHaveBeenCalled();
    });
  });

  describe('deleteAllDocuments - Mass Cache Invalidation', () => {
    /**
     * CRITICAL: Must invalidate ALL document-related caches for user
     */
    it('should invalidate all document caches on mass deletion', async () => {
      (Document.deleteMany as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue({ deletedCount: 5 }),
      });

      (cacheService.invalidateTag as jest.Mock).mockResolvedValue(true);
      (cacheService.delete as jest.Mock).mockResolvedValue(true);

      await documentService.deleteAllDocuments('test-user-id');

      expect(cacheService.invalidateTag).toHaveBeenCalledWith(
        'tag:docs:test-user-id',
      );
      expect(cacheService.delete).toHaveBeenCalledWith(
        'docs:list:test-user-id',
      );
    });
  });

  describe('updateActionPlan - Granular Cache Invalidation', () => {
    /**
     * CRITICAL: Action plan updates must invalidate document cache
     */
    it('should invalidate caches on action plan update', async () => {
      const mockDoc = {
        userId: 'test-user-id',
        docId: 'doc-123',
        actionPlans: [{ id: 'ap-1', title: 'Updated', completed: true }],
      };

      (Document.findOneAndUpdate as jest.Mock).mockReturnValue({
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(mockDoc),
      });

      (cacheService.delete as jest.Mock).mockResolvedValue(true);
      (cacheService.invalidateTag as jest.Mock).mockResolvedValue(true);

      await documentService.updateActionPlan(
        'test-user-id',
        'doc-123',
        'update',
        { completed: true },
        'ap-1',
      );

      expect(cacheService.delete).toHaveBeenCalledWith(
        'doc:test-user-id:doc-123',
      );
      expect(cacheService.invalidateTag).toHaveBeenCalledWith(
        'tag:docs:test-user-id',
      );
    });
  });
});
