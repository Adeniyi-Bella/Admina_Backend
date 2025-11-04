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
const config_1 = __importDefault(require("../../config"));
const winston_1 = require("../../lib/winston");
const tsyringe_1 = require("tsyringe");
const api_response_1 = require("../../lib/api_response");
const getAllDocuments = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const documentService = tsyringe_1.container.resolve('IDocumentService');
    const userService = tsyringe_1.container.resolve('IUserService');
    try {
        const user = yield userService.checkIfUserExist(req);
        if (!user) {
            api_response_1.ApiResponse.notFound(res, 'User not found');
            return;
        }
        const limit = parseInt(req.query.limit) || config_1.default.defaultResLimit;
        const offset = parseInt(req.query.offset) || config_1.default.defaultResOffset;
        const { total, documents } = yield documentService.getAllDocumentsByUserId(user, limit, offset);
        const responseDocuments = documents.map((doc) => {
            var _a;
            return ({
                docId: doc.docId,
                title: doc.title,
                sender: doc.sender,
                receivedDate: doc.receivedDate,
                actionPlans: (_a = doc.actionPlans) === null || _a === void 0 ? void 0 : _a.map((ap) => ({
                    title: ap.title,
                    dueDate: ap.dueDate,
                    completed: ap.completed,
                    location: ap.location,
                })),
            });
        });
        res.status(200).json({
            limit,
            offset,
            total,
            documents: responseDocuments,
            userPlan: user.plan,
        });
    }
    catch (error) {
        winston_1.logger.error('Error getting all documents', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        api_response_1.ApiResponse.serverError(res, 'Internal server error', errorMessage);
    }
});
exports.default = getAllDocuments;
