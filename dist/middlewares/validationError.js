"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_validator_1 = require("express-validator");
const api_response_1 = require("../lib/api_response");
const validationError = (req, res, next) => {
    const errors = (0, express_validator_1.validationResult)(req);
    if (!errors.isEmpty()) {
        api_response_1.ApiResponse.badRequest(res, 'ValidationError.', errors.mapped());
        return;
    }
    next();
};
exports.default = validationError;
