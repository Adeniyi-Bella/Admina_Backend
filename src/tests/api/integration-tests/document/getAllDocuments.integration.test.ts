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
import { IDocumentService } from '@/services/document/document.interface';
import { logger } from '@/lib/winston';
import { IDocument } from '@/models/document.model';
import { Server } from 'http';

// Mock config
jest.mock('@/config', () => ({
  defaultResLimit: 10,
  defaultResOffset: 0,
}));

// Mock logger
jest.mock('@/lib/winston', () => ({
  logger: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
  },
}));

// Mock Mongoose models
jest.mock('@/models/document.model');
jest.mock('@/models/chatbotHistory.model');

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
  return (req: Request, res: Response, next: NextFunction) => {
    next();
  };
});

const app = express();
app.use(express.json());
app.use('/documents', router);
let server: Server;

describe('Document Routes - GET /documents', () => {
  let documentService: MockProxy<IDocumentService>;
  const userId = 'test-user-id';
  const docId = `${uuidv4()}.pdf`;

  beforeAll(async () => {
    server = app.listen(0);
    await new Promise((resolve) => server.once('listening', resolve));
  });

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    // Mock all services
    documentService = mock<IDocumentService>();

    // Register mocks in tsyringe container
    container.register('IDocumentService', { useValue: documentService });
  });

  afterEach(() => {
    jest.clearAllTimers();
    container.clearInstances();
  });

  afterAll(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  it('should return paginated documents with valid limit and offset', async () => {
    const mockDocuments: IDocument[] = [
      {
        userId,
        docId,
        title: 'Test Document',
        summary: 'Summary',
        translatedText: 'Translated',
        targetLanguage: 'es',
        pdfBlobStorage: true,
        createdAt: new Date('2025-08-06T21:10:29.978Z'),
        updatedAt: new Date('2025-08-06T21:10:29.978Z'),
      },
    ];
    documentService.getAllDocumentsByUserId.mockResolvedValue({
      total: 1,
      documents: mockDocuments,
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
          pdfBlobStorage: true,
          createdAt: '2025-08-06T21:10:29.978Z',
          updatedAt: '2025-08-06T21:10:29.978Z',
        },
      ],
    });
    expect(documentService.getAllDocumentsByUserId).toHaveBeenCalledWith(
      userId,
      10,
      0,
    );
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
        pdfBlobStorage: true,
        createdAt: new Date('2025-08-06T21:10:29.978Z'),
        updatedAt: new Date('2025-08-06T21:10:29.978Z'),
      },
    ];
    documentService.getAllDocumentsByUserId.mockResolvedValue({
      total: 1,
      documents: mockDocuments,
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
          pdfBlobStorage: true,
          createdAt: '2025-08-06T21:10:29.978Z',
          updatedAt: '2025-08-06T21:10:29.978Z',
        },
      ],
    });
    expect(documentService.getAllDocumentsByUserId).toHaveBeenCalledWith(
      userId,
      10,
      0,
    );
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
    expect(documentService.getAllDocumentsByUserId).not.toHaveBeenCalled();
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
    expect(documentService.getAllDocumentsByUserId).not.toHaveBeenCalled();
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
    expect(documentService.getAllDocumentsByUserId).not.toHaveBeenCalled();
  });

  it('should return 500 if DocumentService throws an error', async () => {
    const error = new Error('Database error');
    documentService.getAllDocumentsByUserId.mockRejectedValue(error);

    const response = await request(app)
      .get('/documents?limit=10&offset=0')
      .set('Accept', 'application/json');

    expect(response.status).toBe(500);
    expect(response.body).toEqual({
      code: 'SERVER_ERROR',
      message: 'Internal server error',
      data: 'Database error',
      status: 'error',
      timestamp: expect.any(String),
      version: '1.0.0',
    });
    expect(logger.error).toHaveBeenCalledWith('Error getting all documents', error);
    expect(documentService.getAllDocumentsByUserId).toHaveBeenCalledWith(
      userId,
      10,
      0,
    );
  });
});