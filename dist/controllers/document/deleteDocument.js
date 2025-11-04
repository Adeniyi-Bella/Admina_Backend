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
const winston_1 = require("../../lib/winston");
const tsyringe_1 = require("tsyringe");
const api_response_1 = require("../../lib/api_response");
const deleteDocument = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const chatBotService = tsyringe_1.container.resolve('IChatBotService');
    const documentService = tsyringe_1.container.resolve('IDocumentService');
    try {
        const userId = req.userId;
        const docId = req.params.docId;
        const deleteChatHistory = yield chatBotService.deleteChatHistoryByDocument(userId, docId);
        const deleted = yield documentService.deleteDocument(userId, docId);
        if (!deleted || !deleteChatHistory) {
            api_response_1.ApiResponse.notFound(res, 'Document not found');
            return;
        }
        api_response_1.ApiResponse.ok(res, 'Documents deleted successfully');
    }
    catch (error) {
        winston_1.logger.error('Error deleting document', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        api_response_1.ApiResponse.serverError(res, 'Internal server error', errorMessage);
    }
});
exports.default = deleteDocument;
