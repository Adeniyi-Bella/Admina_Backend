"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const authenticate_1 = __importDefault(require("../../middlewares/authenticate"));
const resetPropertiesIfNewMonth_1 = __importDefault(require("../../middlewares/resetPropertiesIfNewMonth"));
const translate_jobs_controller_1 = require("../../controllers/jobs/translate.jobs.controller");
const router = (0, express_1.Router)();
router.use(authenticate_1.default);
router.use(resetPropertiesIfNewMonth_1.default);
router.get('/:jobId/status', translate_jobs_controller_1.getJobStatusController);
exports.default = router;
