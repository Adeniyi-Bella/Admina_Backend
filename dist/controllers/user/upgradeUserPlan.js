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
const upgradeUserPlan = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const userService = tsyringe_1.container.resolve('IUserService');
    const docService = tsyringe_1.container.resolve('IDocumentService');
    try {
        const user = yield userService.checkIfUserExist(req);
        if (!user) {
            winston_1.logger.error('User not found during upgradeUserPlan');
            api_response_1.ApiResponse.notFound(res, 'User not found');
            return;
        }
        const currentPlan = user.plan;
        const planToUpgradeTo = req.params.plan;
        const allowedPlans = ['standard', 'premium'];
        if (!allowedPlans.includes(planToUpgradeTo)) {
            winston_1.logger.error(`Invalid target plan: ${planToUpgradeTo}`);
            api_response_1.ApiResponse.badRequest(res, `Invalid target plan: ${planToUpgradeTo}. Must be "standard" or "premium".`);
            return;
        }
        switch (currentPlan) {
            case 'free':
                break;
            case 'standard':
                if (planToUpgradeTo !== 'premium') {
                    winston_1.logger.error('Standard plan can only be upgraded to premium');
                    api_response_1.ApiResponse.badRequest(res, 'Standard plan can only be upgraded to premium');
                    return;
                }
                break;
            case 'premium':
                winston_1.logger.error('Premium plan cannot be upgraded further');
                api_response_1.ApiResponse.badRequest(res, 'Premium plan cannot be upgraded further');
                return;
            default:
                winston_1.logger.error(`Unknown current plan: ${currentPlan}`);
                api_response_1.ApiResponse.badRequest(res, `Unknown current plan: ${currentPlan}`);
                return;
        }
        yield userService.updateUser(req.userId, 'plan', false, planToUpgradeTo);
        const newLengthOfDocs = planToUpgradeTo === 'standard'
            ? { standard: { max: 3, min: 0, current: 3 } }
            : { premium: { max: 5, min: 0, current: 5 } };
        yield userService.updateUser(req.userId, 'lengthOfDocs', false, newLengthOfDocs);
        const maxDocsForPrevPlan = currentPlan === 'free'
            ? user.lengthOfDocs.free.max
            : user.lengthOfDocs.standard.max;
        const { documents } = yield docService.getAllDocumentsByUserId(user, maxDocsForPrevPlan, 0);
        const newChatBotPrompt = planToUpgradeTo === 'standard'
            ? { standard: { max: 5, min: 0, current: 5 } }
            : { premium: { max: 10, min: 0, current: 10 } };
        for (const doc of documents) {
            yield docService.updateDocument(req.userId, doc.docId, {
                chatBotPrompt: newChatBotPrompt,
            });
        }
        winston_1.logger.info(`User upgraded successfully from ${currentPlan} to ${planToUpgradeTo} and document chatBotPrompt updated`, {
            user: {
                id: user.userId,
                email: user.email,
            },
        });
        api_response_1.ApiResponse.ok(res, 'User upgraded successfully');
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        api_response_1.ApiResponse.serverError(res, 'Internal server error', errorMessage);
        winston_1.logger.error('Error upgrading user', errorMessage);
    }
});
exports.default = upgradeUserPlan;
