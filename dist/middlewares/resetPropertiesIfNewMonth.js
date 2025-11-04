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
const user_model_1 = __importDefault(require("../models/user.model"));
const document_model_1 = __importDefault(require("../models/document.model"));
const chatbotHistory_model_1 = __importDefault(require("../models/chatbotHistory.model"));
const winston_1 = require("../lib/winston");
const api_response_1 = require("../lib/api_response");
const formatDate = (date) => {
    if (!date)
        return 'none';
    const day = String(date.getUTCDate()).padStart(2, '0');
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const year = date.getUTCFullYear();
    const hours = String(date.getUTCHours()).padStart(2, '0');
    const minutes = String(date.getUTCMinutes()).padStart(2, '0');
    return `${day}/${month}/${year}: ${hours}:${minutes}`;
};
const resetPropertiesIfNewMonth = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    const userId = req.userId;
    if (!userId) {
        winston_1.logger.warn('No userId provided in request for resetPropertiesIfNewMonth');
        api_response_1.ApiResponse.badRequest(res, 'No userId provided in request for resetPropertiesIfNewMonth.');
        return;
    }
    try {
        const user = yield user_model_1.default.findOne({ userId }).select('plan updatedAt').exec();
        if (!user) {
            winston_1.logger.warn('User not found for resetPropertiesIfNewMonth', { userId });
            api_response_1.ApiResponse.notFound(res, 'User not found');
            return;
        }
        const latestDocument = yield document_model_1.default.findOne({ userId })
            .sort({ updatedAt: -1 })
            .select('updatedAt')
            .exec();
        const latestChatBotHistory = yield chatbotHistory_model_1.default.findOne({ userId })
            .sort({ updatedAt: -1 })
            .select('updatedAt')
            .exec();
        const now = new Date();
        const userLastUpdated = new Date(user.updatedAt);
        const documentLastUpdated = latestDocument
            ? new Date(latestDocument.updatedAt)
            : null;
        const chatBotHistoryLastUpdated = latestChatBotHistory
            ? new Date(latestChatBotHistory.updatedAt)
            : null;
        const timestamps = [
            userLastUpdated,
            documentLastUpdated,
            chatBotHistoryLastUpdated,
        ].filter((ts) => ts !== null);
        const mostRecentUpdate = timestamps.length > 0
            ? new Date(Math.max(...timestamps.map((ts) => ts.getTime())))
            : userLastUpdated;
        const isNewMonth = mostRecentUpdate.getUTCFullYear() !== now.getUTCFullYear() ||
            mostRecentUpdate.getUTCMonth() !== now.getUTCMonth();
        if (isNewMonth) {
            console.log('New Month Detected');
            const resetLengthOfDocs = {
                lengthOfDocs: {
                    premium: { max: 5, min: 0, current: 5 },
                    standard: { max: 3, min: 0, current: 3 },
                    free: { max: 2, min: 0, current: 2 },
                },
                updatedAt: new Date(),
            };
            const resetChatBotPrompts = {
                chatBotPrompt: {
                    premium: { max: 10, min: 0, current: 10 },
                    standard: { max: 5, min: 0, current: 5 },
                    free: { max: 0, min: 0, current: 0 },
                },
                updatedAt: new Date(),
            };
            const lengthOfDocsResult = yield user_model_1.default.updateOne({ userId }, { $set: resetLengthOfDocs }).exec();
            const documentsResult = yield document_model_1.default.updateMany({ userId }, { $set: resetChatBotPrompts }).exec();
            if (lengthOfDocsResult.modifiedCount === 0 &&
                documentsResult.modifiedCount === 0) {
                winston_1.logger.warn('Failed to reset user properties', { userId });
                api_response_1.ApiResponse.serverError(res, 'Failed to reset user properties');
                return;
            }
        }
        else {
            winston_1.logger.info('No reset needed; not a new month', {
                user: {
                    id: user.userId,
                    email: user.email,
                    plan: user.plan,
                },
            });
        }
        next();
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        api_response_1.ApiResponse.serverError(res, 'Error in reset PRoperties new month', errorMessage);
        winston_1.logger.error('Error in reset PRoperties new month', errorMessage);
    }
});
exports.default = resetPropertiesIfNewMonth;
