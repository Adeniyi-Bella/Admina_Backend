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
const tsyringe_1 = require("tsyringe");
const winston_1 = require("../../lib/winston");
const api_response_1 = require("../../lib/api_response");
const deleteUser = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const userService = tsyringe_1.container.resolve('IUserService');
    const chatBotService = tsyringe_1.container.resolve('IChatBotService');
    const documentService = tsyringe_1.container.resolve('IDocumentService');
    try {
        yield documentService.deleteAllDocuments(req.userId);
        yield chatBotService.deleteChatHistoryByUserId(req.userId);
        const deleteUserFromDb = yield userService.deleteUser(req.userId);
        if (!deleteUserFromDb) {
            winston_1.logger.error('User not found in database for deletion');
            api_response_1.ApiResponse.notFound(res, 'User not found');
            return;
        }
        const deleteUserFromEntraId = yield userService.deleteUserFromEntraId(req.userId);
        if (!deleteUserFromEntraId) {
            winston_1.logger.error('User not found in Entra Id for deletion');
            api_response_1.ApiResponse.notFound(res, 'User not found in Entra Id');
            return;
        }
        winston_1.logger.info('User deleted successfully');
        api_response_1.ApiResponse.noContent(res);
    }
    catch (error) {
        winston_1.logger.error('Error deleting document', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        api_response_1.ApiResponse.serverError(res, 'Internal server error', errorMessage);
    }
});
exports.default = deleteUser;
