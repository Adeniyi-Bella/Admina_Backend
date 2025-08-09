/**
 * @copyright 2025 Adeniyi Bella
 * @license Apache-2.0
 */

import 'reflect-metadata';
import request from 'supertest';
import express, { Request, Response, NextFunction } from 'express';
import { container } from 'tsyringe';
import { mock, MockProxy } from 'jest-mock-extended';
import { v4 as uuidv4 } from 'uuid';
import router from '@/routes/v1/document.route';
import Document, { IDocument } from '@/models/document.model';
import { IOpenAIService } from '@/services/openai/openai.interface';
import { IUserService } from '@/services/users/user.interface';
import { IAzureFreeSubscriptionService } from '@/services/azure/free-users/azure.free.interface';
import { logger } from '@/lib/winston';
import { DocumentService } from '@/services/document/document.service';

// Mock config
jest.mock('@/config', () => ({
  defaultResLimit: 10,
  defaultResOffset: 0,
}));

// Mock logger module entirely to ensure consistent instance
jest.mock('@/lib/winston', () => ({
  logger: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
  },
}));

// Mock middleware
jest.mock('@/middlewares/authenticate', () => {
  return (req: Request, res: Response, next: NextFunction) => {
    req.userId = 'test-user-id';
    next();
  };
});

jest.mock('@/middlewares/validationError', () => {
  return (req: Request, res: Response, next: NextFunction) => {
    const errors = require('express-validator').validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    next();
  };
});

jest.mock('@/middlewares/resetPropertiesIfNewMonth', () => {
  return jest.fn((req: Request, res: Response, next: NextFunction) => {
    next();
  });
});

// Mock Mongoose models
jest.mock('@/models/document.model');
jest.mock('@/models/user.model');

const app = express();
app.use(express.json());
app.use('/documents', router);

describe('Document Routes - GET /documents (Integration Test)', () => {
  const userId = 'test-user-id';
  const docId = `${uuidv4()}.pdf`;

  let chatGtpService: MockProxy<IOpenAIService>;
  let userService: MockProxy<IUserService>;
  let azureFreeSubscriptionService: MockProxy<IAzureFreeSubscriptionService>;

  beforeEach(() => {
    jest.clearAllMocks();

    // Register real DocumentService
    container.register('IDocumentService', { useClass: DocumentService });

    // Mock unused services for router consistency
    chatGtpService = mock<IOpenAIService>();
    userService = mock<IUserService>();
    azureFreeSubscriptionService = mock<IAzureFreeSubscriptionService>();
    container.register('IOpenAIService', { useValue: chatGtpService });
    container.register('IUserService', { useValue: userService });
    container.register('IAzureFreeSubscriptionService', {
      useValue: azureFreeSubscriptionService,
    });
  });

  describe('GET /documents', () => {
    it('should return paginated documents with valid limit and offset', async () => {
      const mockDocuments: IDocument[] = [
        {
          userId,
          docId,
          title: 'Test Document',
          summary: 'Summary',
          translatedText: 'Translated',
          targetLanguage: 'es',
          createdAt: new Date('2025-08-06T21:10:29.978Z'),
          updatedAt: new Date('2025-08-06T21:10:29.978Z'),
        },
      ];
      (Document.countDocuments as jest.Mock).mockResolvedValue(1);
      (Document.find as jest.Mock).mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(mockDocuments),
      });

      const response = await request(app)
        .get('/documents?limit=10&offset=0')
        .set('Accept', 'application/json');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        limit: 10,
        offset: 0,
        total: 1,
        documents: [
          {
            userId,
            docId,
            title: 'Test Document',
            summary: 'Summary',
            translatedText: 'Translated',
            targetLanguage: 'es',
            createdAt: '2025-08-06T21:10:29.978Z',
            updatedAt: '2025-08-06T21:10:29.978Z',
          },
        ],
      });
      expect(Document.find).toHaveBeenCalledWith({ userId });
      expect(Document.find().limit).toHaveBeenCalledWith(10);
      expect(Document.find().skip).toHaveBeenCalledWith(0);
      expect(Document.countDocuments).toHaveBeenCalledWith({ userId });
    });

    it('should use default limit and offset from config if not provided', async () => {
      const mockDocuments: IDocument[] = [
        {
          userId,
          docId,
          title: 'Test Document',
          summary: 'Summary',
          translatedText: 'Translated',
          targetLanguage: 'es',
          createdAt: new Date('2025-08-06T21:10:29.978Z'),
          updatedAt: new Date('2025-08-06T21:10:29.978Z'),
        },
      ];
      (Document.countDocuments as jest.Mock).mockResolvedValue(1);
      (Document.find as jest.Mock).mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(mockDocuments),
      });

      const response = await request(app)
        .get('/documents')
        .set('Accept', 'application/json');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        limit: 10,
        offset: 0,
        total: 1,
        documents: [
          {
            userId,
            docId,
            title: 'Test Document',
            summary: 'Summary',
            translatedText: 'Translated',
            targetLanguage: 'es',
            createdAt: '2025-08-06T21:10:29.978Z',
            updatedAt: '2025-08-06T21:10:29.978Z',
          },
        ],
      });
      expect(Document.find().limit).toHaveBeenCalledWith(10);
      expect(Document.find().skip).toHaveBeenCalledWith(0);
    });

    it('should return 400 for invalid limit', async () => {
      const response = await request(app)
        .get('/documents?limit=51')
        .set('Accept', 'application/json');

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        errors: [
          {
            msg: 'Limit must be between 1 to 20',
            path: 'limit',
            type: 'field',
            value: '51',
            location: 'query',
          },
        ],
      });
    });

    it('should return 400 for non-integer limit', async () => {
      const response = await request(app)
        .get('/documents?limit=abc')
        .set('Accept', 'application/json');

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        errors: [
          {
            msg: 'Limit must be between 1 to 20',
            path: 'limit',
            type: 'field',
            value: 'abc',
            location: 'query',
          },
        ],
      });
    });

    it('should return 400 for negative offset', async () => {
      const response = await request(app)
        .get('/documents?offset=-1')
        .set('Accept', 'application/json');

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        errors: [
          {
            msg: 'Offset must be a positive integer',
            path: 'offset',
            type: 'field',
            value: '-1',
            location: 'query',
          },
        ],
      });
    });

    it('should return 500 if DocumentService throws an error', async () => {
      (Document.find as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockRejectedValue(new Error('Database error')),
      });

      const response = await request(app)
        .get('/documents?limit=10&offset=0')
        .set('Accept', 'application/json');

      expect(response.status).toBe(500);
      expect(response.body).toEqual({
        code: 'ServerError',
        message: 'Internal server error',
        error: expect.any(Object),
      });
      expect(logger.error).toHaveBeenCalledWith(
        'Error while getting all documents',
        expect.any(Error),
      );
    });
  });
});