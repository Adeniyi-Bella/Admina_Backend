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
const downgradeUserPlan = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const userService = tsyringe_1.container.resolve('IUserService');
    const docService = tsyringe_1.container.resolve('IDocumentService');
    try {
        const user = yield userService.checkIfUserExist(req);
        if (!user) {
            winston_1.logger.error('User not found during downgradeUserPlan');
            api_response_1.ApiResponse.notFound(res, 'User not found');
            return;
        }
        const currentPlan = user.plan;
        const planToDowngradeTo = req.params.plan;
        const allowedPlans = ['standard', 'free'];
        if (!allowedPlans.includes(planToDowngradeTo)) {
            winston_1.logger.error(`Invalid target plan: ${planToDowngradeTo}`);
            api_response_1.ApiResponse.badRequest(res, `Invalid target plan: ${planToDowngradeTo}. Must be "standard" or "free".`);
            return;
        }
        switch (currentPlan) {
            case 'free':
                winston_1.logger.error('Free plan cannot be downgraded further');
                api_response_1.ApiResponse.badRequest(res, 'Free plan cannot be downgraded further');
                return;
            case 'standard':
                if (planToDowngradeTo !== 'free') {
                    winston_1.logger.error('Standard plan can only be downgraded to free');
                    api_response_1.ApiResponse.badRequest(res, 'Standard plan can only be downgraded to free');
                    return;
                }
                break;
            case 'premium':
                break;
            default:
                winston_1.logger.error(`Unknown current plan: ${currentPlan}`);
                api_response_1.ApiResponse.badRequest(res, `Unknown current plan: ${currentPlan}`);
                return;
        }
        yield userService.updateUser(req.userId, 'plan', false, planToDowngradeTo);
        const newLengthOfDocs = planToDowngradeTo === 'standard'
            ? { standard: { max: 3, min: 0, current: 3 } }
            : { free: { max: 2, min: 0, current: 2 } };
        yield userService.updateUser(req.userId, 'lengthOfDocs', false, newLengthOfDocs);
        const maxDocsForPrevPlan = currentPlan === 'premium'
            ? user.lengthOfDocs.premium.max
            : user.lengthOfDocs.standard.max;
        const { documents } = yield docService.getAllDocumentsByUserId(user, maxDocsForPrevPlan, 0);
        const newChatBotPrompt = planToDowngradeTo === 'standard'
            ? { standard: { max: 5, min: 0, current: 5 } }
            : { free: { max: 0, min: 0, current: 0 } };
        for (const doc of documents) {
            yield docService.updateDocument(req.userId, doc.docId, {
                chatBotPrompt: newChatBotPrompt,
            });
        }
        winston_1.logger.info(`User downgraded successfully from ${currentPlan} to ${planToDowngradeTo} and documents updated`, {
            user: {
                id: user.userId,
                email: user.email,
            },
        });
        api_response_1.ApiResponse.ok(res, 'User downgraded successfully');
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        winston_1.logger.error('Error downgrading user', errorMessage);
        api_response_1.ApiResponse.serverError(res, 'Internal server error', errorMessage);
    }
});
exports.default = downgradeUserPlan;
