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
const getUserDetails = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const userService = tsyringe_1.container.resolve('IUserService');
    try {
        const user = yield userService.checkIfUserExist(req);
        if (!user) {
            api_response_1.ApiResponse.notFound(res, 'User not found');
            return;
        }
        const plan = user.plan;
        const documentLimits = user.lengthOfDocs[plan];
        api_response_1.ApiResponse.ok(res, 'User Details fetched successfully', {
            planName: user.plan,
            documentLimits
        });
    }
    catch (error) {
        winston_1.logger.error('Error fetching document', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        api_response_1.ApiResponse.serverError(res, 'Internal server error', errorMessage);
    }
});
exports.default = getUserDetails;
