"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("reflect-metadata");
const supertest_1 = __importDefault(require("supertest"));
const express_1 = __importDefault(require("express"));
const tsyringe_1 = require("tsyringe");
const jest_mock_extended_1 = require("jest-mock-extended");
const uuid_1 = require("uuid");
const document_route_1 = __importDefault(require("../../../../routes/v1/document.route"));
const winston_1 = require("../../../../lib/winston");
jest.mock('@/config', () => ({
    defaultResLimit: 10,
    defaultResOffset: 0,
}));
jest.mock('@/lib/winston', () => ({
    logger: {
        error: jest.fn(),
        warn: jest.fn(),
        info: jest.fn(),
    },
}));
jest.mock('@/models/document.model');
jest.mock('@/middlewares/authenticate', () => {
    return (req, res, next) => {
        req.userId = 'test-user-id';
        next();
    };
});
jest.mock('@/middlewares/validationError', () => {
    return (req, res, next) => {
        const errors = require('express-validator').validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        next();
    };
});
jest.mock('@/middlewares/resetPropertiesIfNewMonth', () => {
    return (req, res, next) => {
        next();
    };
});
const app = (0, express_1.default)();
app.use(express_1.default.json());
app.use('/documents', document_route_1.default);
let server;
describe('Document Routes - GET /documents', () => {
    let documentService;
    const userId = 'test-user-id';
    const docId = `${(0, uuid_1.v4)()}.pdf`;
    beforeAll(() => __awaiter(void 0, void 0, void 0, function* () {
        server = app.listen(0);
        yield new Promise((resolve) => server.once('listening', resolve));
    }));
    beforeEach(() => {
        jest.clearAllMocks();
        jest.useFakeTimers();
        documentService = (0, jest_mock_extended_1.mock)();
        tsyringe_1.container.register('IDocumentService', { useValue: documentService });
    });
    afterEach(() => {
        jest.clearAllTimers();
        tsyringe_1.container.clearInstances();
    });
    afterAll(() => __awaiter(void 0, void 0, void 0, function* () {
        if (server) {
            yield new Promise((resolve) => server.close(resolve));
        }
    }));
    it('should return paginated documents with valid limit and offset', () => __awaiter(void 0, void 0, void 0, function* () {
        const mockDocuments = [
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
        const response = yield (0, supertest_1.default)(app)
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
        expect(documentService.getAllDocumentsByUserId).toHaveBeenCalledWith(userId, 10, 0);
    }));
    it('should use default limit and offset from config if not provided', () => __awaiter(void 0, void 0, void 0, function* () {
        const mockDocuments = [
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
        const response = yield (0, supertest_1.default)(app)
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
        expect(documentService.getAllDocumentsByUserId).toHaveBeenCalledWith(userId, 10, 0);
    }));
    it('should return 400 for invalid limit', () => __awaiter(void 0, void 0, void 0, function* () {
        const response = yield (0, supertest_1.default)(app)
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
    }));
    it('should return 400 for non-integer limit', () => __awaiter(void 0, void 0, void 0, function* () {
        const response = yield (0, supertest_1.default)(app)
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
    }));
    it('should return 400 for negative offset', () => __awaiter(void 0, void 0, void 0, function* () {
        const response = yield (0, supertest_1.default)(app)
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
    }));
    it('should return 500 if DocumentService throws an error', () => __awaiter(void 0, void 0, void 0, function* () {
        const error = new Error('Database error');
        documentService.getAllDocumentsByUserId.mockRejectedValue(error);
        const response = yield (0, supertest_1.default)(app)
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
        expect(winston_1.logger.error).toHaveBeenCalledWith('Error getting all documents', error);
        expect(documentService.getAllDocumentsByUserId).toHaveBeenCalledWith(userId, 10, 0);
    }));
});
