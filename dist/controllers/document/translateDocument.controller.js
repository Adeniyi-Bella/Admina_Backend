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
const winston_1 = require("../../lib/winston");
const tsyringe_1 = require("tsyringe");
const api_response_1 = require("../../lib/api_response");
const pdf_parse_1 = __importDefault(require("pdf-parse"));
const uuid_1 = require("uuid");
const translateDocument = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const geminiAIService = tsyringe_1.container.resolve('IGeminiAIService');
    const userService = tsyringe_1.container.resolve('IUserService');
    const documentService = tsyringe_1.container.resolve('IDocumentService');
    try {
        const { targetLanguage } = req.body;
        const file = req.file;
        const user = yield userService.checkIfUserExist(req);
        if (!user) {
            api_response_1.ApiResponse.notFound(res, 'User not found');
            return;
        }
        const userPlan = user.plan;
        if (userPlan !== 'free' && userPlan !== 'standard') {
            winston_1.logger.error('Invalid user plan for document summarizing', {
                userId: user.userId,
                plan: user.plan,
            });
            api_response_1.ApiResponse.badRequest(res, 'Invalid user plan.');
            return;
        }
        if (((_a = user.lengthOfDocs[userPlan]) === null || _a === void 0 ? void 0 : _a.current) < 1) {
            api_response_1.ApiResponse.badRequest(res, 'User has processed maximum document for the month.');
            return;
        }
        const data = yield (0, pdf_parse_1.default)(file.buffer);
        const numpages = data.numpages || 0;
        if (user.plan === 'free' && numpages > 2) {
            winston_1.logger.error('Page count exceeds limit for free users', {
                userId: user.userId,
                numpages,
            });
            api_response_1.ApiResponse.badRequest(res, 'Page count exceeds limit for free users.');
            return;
        }
        const translatedDocument = yield geminiAIService.translateDocument(file, targetLanguage);
        const docId = (0, uuid_1.v4)();
        const documentData = {
            userId: user.userId.toString(),
            docId,
            translatedText: translatedDocument.translatedText,
            structuredTranslatedText: translatedDocument.structuredTranslatedText,
            targetLanguage,
            pdfBlobStorage: false
        };
        const createDocument = yield documentService.createDocumentByUserId(documentData);
        if (!createDocument)
            throw new Error('Error during document Creation');
        api_response_1.ApiResponse.ok(res, 'Translation complete', {
            docId: createDocument.docId,
        });
    }
    catch (error) {
        winston_1.logger.error('Error during document processing', {
            error: error.message,
        });
        api_response_1.ApiResponse.serverError(res, 'Error during document processing', error.message);
    }
});
exports.default = translateDocument;
