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
Object.defineProperty(exports, "__esModule", { value: true });
const api_response_1 = require("../../lib/api_response");
const winston_1 = require("../../lib/winston");
const tsyringe_1 = require("tsyringe");
const getDocument = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const documentService = tsyringe_1.container.resolve('IDocumentService');
    const chatBotService = tsyringe_1.container.resolve('IChatBotService');
    const userService = tsyringe_1.container.resolve('IUserService');
    try {
        const userId = req.userId;
        const docId = req.params.docId;
        const user = yield userService.checkIfUserExist(req);
        if (!user) {
            api_response_1.ApiResponse.notFound(res, 'User not found');
            return;
        }
        const document = yield documentService.getDocument(user, docId);
        if (!document) {
            api_response_1.ApiResponse.notFound(res, 'Document not found');
            return;
        }
        let chats = [];
        try {
            const chatHistory = yield chatBotService.getDocumentChatBotCollection(userId, docId);
            chats = (chatHistory === null || chatHistory === void 0 ? void 0 : chatHistory.chats) || [];
        }
        catch (error) {
            winston_1.logger.warn('Chat history not found, returning empty chats array', {
                userId,
                docId,
                error,
            });
        }
        api_response_1.ApiResponse.ok(res, 'Document fetched successfully', {
            document,
            chats,
            userPlan: user.plan,
        });
    }
    catch (error) {
        winston_1.logger.error('Error fetching document', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        api_response_1.ApiResponse.serverError(res, 'Internal server error', errorMessage);
    }
});
exports.default = getDocument;
