"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const router = (0, express_1.Router)();
const user_route_1 = __importDefault(require("../../routes/v1/user.route"));
const document_route_1 = __importDefault(require("../../routes/v1/document.route"));
const chatbot_route_1 = __importDefault(require("../../routes/v1/chatbot.route"));
const jobs_route_1 = __importDefault(require("../../routes/v1/jobs.route"));
const api_response_1 = require("../../lib/api_response");
router.get('/', (_, res) => {
    api_response_1.ApiResponse.ok(res, 'API is live');
});
router.use('/users', user_route_1.default);
router.use('/document', document_route_1.default);
router.use('/chatbot', chatbot_route_1.default);
router.use('/jobs', jobs_route_1.default);
exports.default = router;
