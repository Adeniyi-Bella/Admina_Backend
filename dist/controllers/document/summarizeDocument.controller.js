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
const uuid_1 = require("uuid");
const summarizeDocument = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const geminiAIService = tsyringe_1.container.resolve('IGeminiAIService');
    const userService = tsyringe_1.container.resolve('IUserService');
    const documentService = tsyringe_1.container.resolve('IDocumentService');
    try {
        const reqDociId = req.params.docId;
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
        const document = yield documentService.getDocument(user, reqDociId);
        if (!document) {
            api_response_1.ApiResponse.notFound(res, 'Document not found');
            return;
        }
        const summarizedTextDocument = yield geminiAIService.summarizeDocument(document.translatedText);
        const documentData = {
            title: summarizedTextDocument.title || '',
            sender: summarizedTextDocument.sender || '',
            receivedDate: summarizedTextDocument.receivedDate || new Date(),
            summary: summarizedTextDocument.summary || '',
            actionPlan: summarizedTextDocument.actionPlan || [],
            actionPlans: (summarizedTextDocument.actionPlans || []).map((plan) => ({
                id: plan.id || (0, uuid_1.v4)(),
                title: plan.title || '',
                dueDate: plan.dueDate || new Date(),
                completed: false,
                location: plan.location || '',
            })),
        };
        const updatedDocumentId = yield documentService.updateDocument(user.userId, reqDociId, documentData);
        if (!updatedDocumentId)
            throw new Error('Document cannot be updated');
        let isUpdatedLengthOfDoc;
        if (user.plan === 'free') {
            isUpdatedLengthOfDoc = yield userService.updateUser(user.userId, 'lengthOfDocs.free.current', true, undefined);
        }
        else if (user.plan === 'standard') {
            isUpdatedLengthOfDoc = yield userService.updateUser(user.userId, 'lengthOfDocs.standard.current', true, undefined);
        }
        if (!isUpdatedLengthOfDoc)
            throw new Error('User plan could not be updated');
        api_response_1.ApiResponse.ok(res, 'Summary Completed', {
            docId: updatedDocumentId.docId,
        });
    }
    catch (error) {
        winston_1.logger.error('Error during document processing', {
            error: error.message,
        });
        api_response_1.ApiResponse.serverError(res, 'Error during document processing', error.message);
    }
});
exports.default = summarizeDocument;
