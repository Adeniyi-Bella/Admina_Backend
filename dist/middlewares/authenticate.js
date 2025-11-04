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
const jwt_1 = require("../lib/jwt");
const winston_1 = require("../lib/winston");
const api_response_1 = require("../lib/api_response");
const authenticate = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    const authHeader = req.headers.authorization;
    if (!(authHeader === null || authHeader === void 0 ? void 0 : authHeader.startsWith('Bearer '))) {
        winston_1.logger.error('Access denied, No Bearer Token');
        api_response_1.ApiResponse.unauthorized(res, '');
        return;
    }
    const [_, token] = authHeader.split(' ');
    try {
        const jwtPayload = (yield (0, jwt_1.verifyAccessToken)(token));
        if (!jwtPayload.oid) {
            winston_1.logger.error('Token does not have an oid');
            throw new Error('Access denied, invalid token');
        }
        req.userId = jwtPayload.oid;
        req.email = jwtPayload.email;
        req.username = jwtPayload.username;
        return next();
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        winston_1.logger.error('Access denied, invalid token', {
            errorMessage: errorMessage,
            token,
            stack: error instanceof Error ? error.stack : undefined,
        });
        api_response_1.ApiResponse.unauthorized(res, 'Access denied, invalid token');
    }
});
exports.default = authenticate;
