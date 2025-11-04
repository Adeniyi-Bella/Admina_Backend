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
const createUser = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    const userService = tsyringe_1.container.resolve('IUserService');
    try {
        let user = yield userService.checkIfUserExist(req);
        if (!user) {
            yield userService.createUserFromToken(req);
        }
        return next();
    }
    catch (error) {
        winston_1.logger.error('Error creating user', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        api_response_1.ApiResponse.serverError(res, 'Internal server error', errorMessage);
    }
});
exports.default = createUser;
