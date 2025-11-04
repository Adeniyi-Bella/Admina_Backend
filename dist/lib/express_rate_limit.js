"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const config_1 = __importDefault(require("../config"));
const express_rate_limit_1 = require("express-rate-limit");
const limiter = (0, express_rate_limit_1.rateLimit)({
    windowMs: 60000,
    limit: 60,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: {
        error: 'You have sent too many requests in a given amount of time. Please try again later.',
    },
    skip: (req, res) => {
        const environment = config_1.default.NODE_ENV;
        return environment === "local";
    },
});
exports.default = limiter;
