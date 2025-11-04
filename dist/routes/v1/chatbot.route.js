"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const express_validator_1 = require("express-validator");
const authenticate_1 = __importDefault(require("../../middlewares/authenticate"));
const validationError_1 = __importDefault(require("../../middlewares/validationError"));
const resetPropertiesIfNewMonth_1 = __importDefault(require("../../middlewares/resetPropertiesIfNewMonth"));
const chatbot_controller_1 = __importDefault(require("../../controllers/chatbot/chatbot.controller"));
const router = (0, express_1.Router)();
router.use(authenticate_1.default);
router.use(resetPropertiesIfNewMonth_1.default);
router.patch('/:docId', (0, express_validator_1.param)('docId').notEmpty().isUUID().withMessage('Invalid doId ID'), (0, express_validator_1.body)('userPrompt')
    .exists().trim().notEmpty()
    .withMessage('Prompt is required')
    .isString()
    .withMessage('Prompt must be a string'), validationError_1.default, chatbot_controller_1.default);
exports.default = router;
