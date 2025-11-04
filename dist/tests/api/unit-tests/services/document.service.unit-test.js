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
const document_model_1 = __importDefault(require("../../../../models/document.model"));
const winston_1 = require("../../../../lib/winston");
const document_service_1 = require("../../../../services/document/document.service");
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
    let service;
    const userId = 'user123';
    const docId = 'doc123';
    beforeEach(() => {
        service = new document_service_1.DocumentService();
        jest.clearAllMocks();
    });
    describe('deleteAllDocuments', () => {
        it('should delete all documents successfully', () => __awaiter(void 0, void 0, void 0, function* () {
            document_model_1.default.deleteMany.mockReturnValue({ exec: () => Promise.resolve({ deletedCount: 2 }) });
            const result = yield service.deleteAllDocuments(userId);
            expect(result).toBe(true);
            expect(winston_1.logger.info).toHaveBeenCalledWith('All documents deleted successfully', {
                userId,
                deletedCount: 2,
            });
        }));
        it('should log info if no documents found', () => __awaiter(void 0, void 0, void 0, function* () {
            document_model_1.default.deleteMany.mockReturnValue({ exec: () => Promise.resolve({ deletedCount: 0 }) });
            yield service.deleteAllDocuments(userId);
            expect(winston_1.logger.info).toHaveBeenCalledWith('No documents found for deletion', { userId });
        }));
        it('should throw error if deletion fails', () => __awaiter(void 0, void 0, void 0, function* () {
            document_model_1.default.deleteMany.mockReturnValue({ exec: () => Promise.reject(new Error('DB error')) });
            yield expect(service.deleteAllDocuments(userId)).rejects.toThrow('Failed to delete all documents: DB error');
            expect(winston_1.logger.error).toHaveBeenCalled();
        }));
    });
    describe('getAllDocumentsByUserId', () => {
        it('should throw error if userId is missing', () => __awaiter(void 0, void 0, void 0, function* () {
            yield expect(service.getAllDocumentsByUserId('', 10, 0)).rejects.toThrow('Valid userId is required');
        }));
        it('should return documents with total count', () => __awaiter(void 0, void 0, void 0, function* () {
            document_model_1.default.countDocuments.mockResolvedValue(5);
            document_model_1.default.find.mockReturnValue({
                sort: jest.fn().mockReturnThis(),
                select: jest.fn().mockReturnThis(),
                limit: jest.fn().mockReturnThis(),
                skip: jest.fn().mockReturnThis(),
                lean: jest.fn().mockReturnThis(),
                exec: jest.fn().mockResolvedValue([{ docId }]),
            });
            const result = yield service.getAllDocumentsByUserId(userId, 10, 0);
            expect(result.total).toBe(5);
            expect(result.documents).toEqual([{ docId }]);
        }));
    });
    describe('createDocumentByUserId', () => {
        it('should throw if document data is invalid', () => __awaiter(void 0, void 0, void 0, function* () {
            yield expect(service.createDocumentByUserId({})).rejects.toThrow('Valid document data is required');
        }));
        it('should create and return a document', () => __awaiter(void 0, void 0, void 0, function* () {
            const mockDoc = { _id: 'id123' };
            document_model_1.default.create.mockResolvedValue(mockDoc);
            document_model_1.default.findById.mockReturnValue({
                select: jest.fn().mockReturnThis(),
                lean: jest.fn().mockReturnThis(),
                exec: jest.fn().mockResolvedValue({ docId }),
            });
            const result = yield service.createDocumentByUserId({ userId, docId });
            expect(result).toEqual({ docId });
            expect(winston_1.logger.info).toHaveBeenCalledWith('Document created successfully');
        }));
        it('should throw if findById returns null', () => __awaiter(void 0, void 0, void 0, function* () {
            const mockDoc = { _id: 'id123' };
            document_model_1.default.create.mockResolvedValue(mockDoc);
            document_model_1.default.findById.mockReturnValue({
                select: jest.fn().mockReturnThis(),
                lean: jest.fn().mockReturnThis(),
                exec: jest.fn().mockResolvedValue(null),
            });
            yield expect(service.createDocumentByUserId({ userId, docId })).rejects.toThrow('Failed to retrieve created document');
        }));
    });
    describe('getDocument', () => {
        it('should throw if userId or docId is missing', () => __awaiter(void 0, void 0, void 0, function* () {
            yield expect(service.getDocument('', docId)).rejects.toThrow('Valid userId and docId are required');
        }));
        it('should return document if found', () => __awaiter(void 0, void 0, void 0, function* () {
            document_model_1.default.findOne.mockReturnValue({
                select: jest.fn().mockReturnThis(),
                exec: jest.fn().mockResolvedValue({ docId }),
            });
            const result = yield service.getDocument(userId, docId);
            expect(result).toEqual({ docId });
        }));
        it('should throw if not found', () => __awaiter(void 0, void 0, void 0, function* () {
            document_model_1.default.findOne.mockReturnValue({
                select: jest.fn().mockReturnThis(),
                exec: jest.fn().mockResolvedValue(null),
            });
            yield expect(service.getDocument(userId, docId)).rejects.toThrow('Document not found');
        }));
    });
    describe('deleteDocument', () => {
        it('should throw if userId or docId is missing', () => __awaiter(void 0, void 0, void 0, function* () {
            yield expect(service.deleteDocument('', docId)).rejects.toThrow('Valid userId and docId are required');
        }));
        it('should delete document successfully', () => __awaiter(void 0, void 0, void 0, function* () {
            document_model_1.default.deleteOne.mockReturnValue({ exec: () => Promise.resolve({ deletedCount: 1 }) });
            const result = yield service.deleteDocument(userId, docId);
            expect(result).toBe(true);
        }));
        it('should return false if no document found', () => __awaiter(void 0, void 0, void 0, function* () {
            document_model_1.default.deleteOne.mockReturnValue({ exec: () => Promise.resolve({ deletedCount: 0 }) });
            const result = yield service.deleteDocument(userId, docId);
            expect(result).toBe(false);
        }));
    });
    describe('updateDocument', () => {
        it('should throw if userId/docId missing', () => __awaiter(void 0, void 0, void 0, function* () {
            yield expect(service.updateDocument('', docId, {})).rejects.toThrow('Valid userId and docId are required');
        }));
        it('should throw if updates missing', () => __awaiter(void 0, void 0, void 0, function* () {
            yield expect(service.updateDocument(userId, docId, {})).rejects.toThrow('Valid update data is required');
        }));
        it('should return updated document', () => __awaiter(void 0, void 0, void 0, function* () {
            document_model_1.default.findOneAndUpdate.mockReturnValue({
                lean: jest.fn().mockReturnThis(),
                exec: jest.fn().mockResolvedValue({ docId }),
            });
            const result = yield service.updateDocument(userId, docId, { title: 'new' });
            expect(result).toEqual({ docId });
        }));
        it('should return null if not found', () => __awaiter(void 0, void 0, void 0, function* () {
            document_model_1.default.findOneAndUpdate.mockReturnValue({
                lean: jest.fn().mockReturnThis(),
                exec: jest.fn().mockResolvedValue(null),
            });
            const result = yield service.updateDocument(userId, docId, { title: 'new' });
            expect(result).toBeNull();
        }));
    });
    describe('updateActionPlan', () => {
        it('should throw if userId/docId missing', () => __awaiter(void 0, void 0, void 0, function* () {
            yield expect(service.updateActionPlan('', docId, 'create')).rejects.toThrow('Valid userId and docId are required');
        }));
        it('should create action plan', () => __awaiter(void 0, void 0, void 0, function* () {
            document_model_1.default.findOneAndUpdate.mockReturnValue({
                lean: jest.fn().mockReturnThis(),
                exec: jest.fn().mockResolvedValue({ docId }),
            });
            const result = yield service.updateActionPlan(userId, docId, 'create', { title: 'Test' });
            expect(result).toEqual({ docId });
        }));
        it('should delete action plan', () => __awaiter(void 0, void 0, void 0, function* () {
            document_model_1.default.findOne.mockReturnValue({ exec: jest.fn().mockResolvedValue({}) });
            document_model_1.default.findOneAndUpdate.mockReturnValue({
                lean: jest.fn().mockReturnThis(),
                exec: jest.fn().mockResolvedValue({ docId }),
            });
            const result = yield service.updateActionPlan(userId, docId, 'delete', undefined, 'ap1');
            expect(result).toEqual({ docId });
        }));
        it('should update action plan', () => __awaiter(void 0, void 0, void 0, function* () {
            document_model_1.default.findOne.mockReturnValue({ exec: jest.fn().mockResolvedValue({}) });
            document_model_1.default.findOneAndUpdate.mockReturnValue({
                lean: jest.fn().mockReturnThis(),
                exec: jest.fn().mockResolvedValue({ docId }),
            });
            const result = yield service.updateActionPlan(userId, docId, 'update', { title: 'new' }, 'ap1');
            expect(result).toEqual({ docId });
        }));
        it('should throw on invalid action', () => __awaiter(void 0, void 0, void 0, function* () {
            yield expect(service.updateActionPlan(userId, docId, 'invalid')).rejects.toThrow('Invalid action type. Must be "create", "delete", or "update"');
        }));
    });
});
