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
const api_response_1 = require("../../../lib/api_response");
const winston_1 = require("../../../lib/winston");
const tsyringe_1 = require("tsyringe");
const updateActionPlan = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const documentService = tsyringe_1.container.resolve('IDocumentService');
    try {
        const userId = req.userId;
        const docId = req.params.docId;
        const actionPlanId = req.params.id;
        const requestType = req.query.type;
        if (!userId || !docId) {
            throw new Error('user id and doc id are required');
        }
        if (!requestType || !['create', 'delete', 'update'].includes(requestType)) {
            api_response_1.ApiResponse.badRequest(res, 'Invalid request type. Must be "create", "delete", or "update"');
            return;
        }
        let updatedDocument = null;
        if (requestType === 'delete') {
            if (!actionPlanId) {
                api_response_1.ApiResponse.badRequest(res, 'Action plan ID is required for delete.');
                return;
            }
            updatedDocument = yield documentService.updateActionPlan(userId, docId, 'delete', undefined, actionPlanId);
        }
        else {
            if (!req.body) {
                api_response_1.ApiResponse.badRequest(res, 'Request body is missing.');
                return;
            }
            if (requestType === 'create') {
                const { title, dueDate, completed, location } = req.body.completed;
                if (!title) {
                    api_response_1.ApiResponse.badRequest(res, 'Request body is missing the right data.');
                    return;
                }
                updatedDocument = yield documentService.updateActionPlan(userId, docId, 'create', {
                    title,
                    dueDate,
                    completed,
                    location,
                });
            }
            else if (requestType === 'update') {
                if (!actionPlanId) {
                    api_response_1.ApiResponse.badRequest(res, 'Action plan ID is required for update.');
                    return;
                }
                let title, dueDate, completed, location;
                if (typeof req.body.completed === 'boolean') {
                    completed = req.body.completed;
                    ({ title, dueDate, location } = req.body);
                }
                else if (typeof req.body.completed === 'object') {
                    ({ title, dueDate, completed, location } = req.body.completed);
                }
                else {
                    api_response_1.ApiResponse.badRequest(res, 'Invalid body format.');
                    return;
                }
                if (!title && !dueDate && completed === undefined && !location) {
                    api_response_1.ApiResponse.badRequest(res, 'At least one field (title, dueDate, completed, location) must be provided for update.');
                    return;
                }
                updatedDocument = yield documentService.updateActionPlan(userId, docId, 'update', { completed, location, title, dueDate }, actionPlanId);
                if (!updatedDocument) {
                    api_response_1.ApiResponse.notFound(res, 'Document or action plan not found for update.');
                    return;
                }
            }
        }
        api_response_1.ApiResponse.ok(res, 'Document fetched successfully', {
            document: updatedDocument,
        });
    }
    catch (error) {
        winston_1.logger.error('Error deleting document', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        api_response_1.ApiResponse.serverError(res, 'Internal server error', errorMessage);
    }
});
exports.default = updateActionPlan;
