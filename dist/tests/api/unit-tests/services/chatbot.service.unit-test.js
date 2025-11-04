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
const chatbotHistory_model_1 = __importDefault(require("../../../../models/chatbotHistory.model"));
const winston_1 = require("../../../../lib/winston");
const chatbot_service_1 = require("../../../../services/chatbot/chatbot.service");
jest.mock('@/models/chatbotHistory.model', () => ({
    findOne: jest.fn(),
    findOneAndUpdate: jest.fn(),
    create: jest.fn(),
    deleteMany: jest.fn(),
}));
jest.mock('@/lib/winston', () => ({
    logger: {
        info: jest.fn(),
        error: jest.fn(),
    },
}));
describe('ChatBotService', () => {
    let service;
    const userId = 'user123';
    const docId = 'doc123';
    const mockChat = { userPrompt: 'Hello', response: 'Hi there', time: new Date() };
    beforeEach(() => {
        service = new chatbot_service_1.ChatBotService();
        jest.clearAllMocks();
    });
    describe('getDocumentChatBotCollection', () => {
        it('should throw if userId or docId is missing', () => __awaiter(void 0, void 0, void 0, function* () {
            yield expect(service.getDocumentChatBotCollection('', docId)).rejects.toThrow('User ID and Document ID are required');
        }));
        it('should return chat history if found', () => __awaiter(void 0, void 0, void 0, function* () {
            chatbotHistory_model_1.default.findOne.mockReturnValue({
                select: jest.fn().mockReturnThis(),
                lean: jest.fn().mockReturnThis(),
                exec: jest.fn().mockResolvedValue({ userId, docId }),
            });
            const result = yield service.getDocumentChatBotCollection(userId, docId);
            expect(result).toEqual({ userId, docId });
        }));
        it('should throw on DB error', () => __awaiter(void 0, void 0, void 0, function* () {
            chatbotHistory_model_1.default.findOne.mockReturnValue({
                select: jest.fn().mockReturnThis(),
                lean: jest.fn().mockReturnThis(),
                exec: jest.fn().mockRejectedValue(new Error('DB error')),
            });
            yield expect(service.getDocumentChatBotCollection(userId, docId)).rejects.toThrow('Failed to retrieve chat history collection: Error: DB error');
            expect(winston_1.logger.error).toHaveBeenCalled();
        }));
    });
    describe('updateDocumentChatBotHistory', () => {
        it('should throw if required data is missing', () => __awaiter(void 0, void 0, void 0, function* () {
            yield expect(service.updateDocumentChatBotHistory(userId, docId, {})).rejects.toThrow('User ID, Document ID, and valid chat data are required');
        }));
        it('should update chat history successfully', () => __awaiter(void 0, void 0, void 0, function* () {
            chatbotHistory_model_1.default.findOneAndUpdate.mockReturnValue({
                select: jest.fn().mockReturnThis(),
                lean: jest.fn().mockReturnThis(),
                exec: jest.fn().mockResolvedValue({}),
            });
            yield service.updateDocumentChatBotHistory(userId, docId, mockChat);
            expect(winston_1.logger.info).toHaveBeenCalledWith('Chat history collection updated successfully', { userId, docId });
        }));
        it('should throw if history not found', () => __awaiter(void 0, void 0, void 0, function* () {
            chatbotHistory_model_1.default.findOneAndUpdate.mockReturnValue({
                select: jest.fn().mockReturnThis(),
                lean: jest.fn().mockReturnThis(),
                exec: jest.fn().mockResolvedValue(null),
            });
            yield expect(service.updateDocumentChatBotHistory(userId, docId, mockChat)).rejects.toThrow('Chat history collection not found for update');
        }));
    });
    describe('addTranslatedText', () => {
        it('should throw if chatBotHistory data is invalid', () => __awaiter(void 0, void 0, void 0, function* () {
            yield expect(service.addTranslatedText({})).rejects.toThrow('Valid chat history data is required');
        }));
        it('should throw if created history not found', () => __awaiter(void 0, void 0, void 0, function* () {
            chatbotHistory_model_1.default.create.mockResolvedValue({});
            chatbotHistory_model_1.default.findOne.mockReturnValue({
                select: jest.fn().mockReturnThis(),
                lean: jest.fn().mockReturnThis(),
                exec: jest.fn().mockResolvedValue(null),
            });
            yield expect(service.addTranslatedText({ userId, docId })).rejects.toThrow('Failed to retrieve New chat history collection');
        }));
    });
    describe('deleteChatHistoryByUserId', () => {
        it('should throw if userId missing', () => __awaiter(void 0, void 0, void 0, function* () {
            yield expect(service.deleteChatHistoryByUserId('')).rejects.toThrow('User ID is required');
        }));
        it('should delete chat history successfully', () => __awaiter(void 0, void 0, void 0, function* () {
            chatbotHistory_model_1.default.deleteMany.mockReturnValue({
                exec: jest.fn().mockResolvedValue({ deletedCount: 2 }),
            });
            const result = yield service.deleteChatHistoryByUserId(userId);
            expect(result).toBe(true);
            expect(winston_1.logger.info).toHaveBeenCalledWith('Chat history deleted successfully', { userId });
        }));
        it('should throw on DB error', () => __awaiter(void 0, void 0, void 0, function* () {
            chatbotHistory_model_1.default.deleteMany.mockReturnValue({
                exec: jest.fn().mockRejectedValue(new Error('DB error')),
            });
            yield expect(service.deleteChatHistoryByUserId(userId)).rejects.toThrow('Failed to delete chat history: Error: DB error');
            expect(winston_1.logger.error).toHaveBeenCalled();
        }));
    });
});
