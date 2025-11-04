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
const user_model_1 = __importDefault(require("../../../../models/user.model"));
const document_model_1 = __importDefault(require("../../../../models/document.model"));
const chatbotHistory_model_1 = __importDefault(require("../../../../models/chatbotHistory.model"));
const winston_1 = require("../../../../lib/winston");
const api_response_1 = require("../../../../lib/api_response");
const resetPropertiesIfNewMonth_1 = __importDefault(require("../../../../middlewares/resetPropertiesIfNewMonth"));
jest.mock('@/models/user.model');
jest.mock('@/models/document.model');
jest.mock('@/models/chatbotHistory.model');
jest.mock('@/lib/winston', () => ({
    logger: {
        warn: jest.fn(),
        info: jest.fn(),
        error: jest.fn(),
    }
}));
jest.mock('@/lib/api_response', () => ({
    ApiResponse: {
        badRequest: jest.fn(),
        notFound: jest.fn(),
        serverError: jest.fn(),
    }
}));
describe('resetPropertiesIfNewMonth middleware', () => {
    const mockReq = { userId: 'user123' };
    const mockRes = {};
    const mockNext = jest.fn();
    beforeEach(() => {
        jest.clearAllMocks();
    });
    it('should return badRequest if userId is missing', () => __awaiter(void 0, void 0, void 0, function* () {
        const req = { userId: undefined };
        yield (0, resetPropertiesIfNewMonth_1.default)(req, mockRes, mockNext);
        expect(api_response_1.ApiResponse.badRequest).toHaveBeenCalledWith(mockRes, expect.stringContaining('No userId'));
        expect(mockNext).not.toHaveBeenCalled();
    }));
    it('should return notFound if user does not exist', () => __awaiter(void 0, void 0, void 0, function* () {
        user_model_1.default.findOne.mockReturnValue({ select: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(null) }) });
        yield (0, resetPropertiesIfNewMonth_1.default)(mockReq, mockRes, mockNext);
        expect(api_response_1.ApiResponse.notFound).toHaveBeenCalledWith(mockRes, 'User not found');
        expect(mockNext).not.toHaveBeenCalled();
    }));
    it('should reset properties if it is a new month', () => __awaiter(void 0, void 0, void 0, function* () {
        const oldDate = new Date('2025-07-30');
        user_model_1.default.findOne.mockReturnValue({ select: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue({ plan: 'free', updatedAt: oldDate }) }) });
        document_model_1.default.findOne.mockReturnValue({ sort: jest.fn().mockReturnValue({ select: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(null) }) }) });
        chatbotHistory_model_1.default.findOne.mockReturnValue({ sort: jest.fn().mockReturnValue({ select: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(null) }) }) });
        user_model_1.default.updateOne.mockReturnValue({ exec: jest.fn().mockResolvedValue({ modifiedCount: 1 }) });
        document_model_1.default.updateMany.mockReturnValue({ exec: jest.fn().mockResolvedValue({ modifiedCount: 1 }) });
        yield (0, resetPropertiesIfNewMonth_1.default)(mockReq, mockRes, mockNext);
        expect(user_model_1.default.updateOne).toHaveBeenCalled();
        expect(document_model_1.default.updateMany).toHaveBeenCalled();
        expect(mockNext).toHaveBeenCalled();
    }));
    it('should log info if no reset needed', () => __awaiter(void 0, void 0, void 0, function* () {
        const now = new Date();
        user_model_1.default.findOne.mockReturnValue({ select: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue({ plan: 'premium', updatedAt: now }) }) });
        document_model_1.default.findOne.mockReturnValue({ sort: jest.fn().mockReturnValue({ select: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(null) }) }) });
        chatbotHistory_model_1.default.findOne.mockReturnValue({ sort: jest.fn().mockReturnValue({ select: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(null) }) }) });
        yield (0, resetPropertiesIfNewMonth_1.default)(mockReq, mockRes, mockNext);
        expect(winston_1.logger.info).toHaveBeenCalledWith(expect.stringContaining('No reset needed'), expect.any(Object));
        expect(mockNext).toHaveBeenCalled();
    }));
    it('should handle errors and return serverError', () => __awaiter(void 0, void 0, void 0, function* () {
        user_model_1.default.findOne.mockImplementation(() => { throw new Error('DB error'); });
        yield (0, resetPropertiesIfNewMonth_1.default)(mockReq, mockRes, mockNext);
        expect(api_response_1.ApiResponse.serverError).toHaveBeenCalledWith(mockRes, 'Error in reset PRoperties new month', 'DB error');
        expect(winston_1.logger.error).toHaveBeenCalled();
    }));
});
