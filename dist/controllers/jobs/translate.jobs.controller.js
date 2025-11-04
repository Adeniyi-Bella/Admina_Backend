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
exports.getJobStatusController = void 0;
const api_response_1 = require("../../lib/api_response");
const job_queues_service_1 = require("../../services/ai-models/jobs/job-queues.service");
const winston_1 = require("../../lib/winston");
const queueService = new job_queues_service_1.TranslateQueueService();
const getJobStatusController = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const jobId = req.params.jobId;
        const job = yield queueService.getJobStatus(jobId);
        if (!job)
            return api_response_1.ApiResponse.notFound(res, 'Job not found');
        if (!job.docId) {
            winston_1.logger.error(`Job ${jobId} exists in Redis but docId is missing`);
            return api_response_1.ApiResponse.serverError(res, 'Job corrupted: missing docId');
        }
        const response = {
            docId: job.docId,
            status: job.status,
        };
        if (job.status === 'error' && job.error) {
            response.error = job.error;
        }
        winston_1.logger.info(`Job ${jobId} status retrieved`, { status: job.status });
        return api_response_1.ApiResponse.ok(res, 'Job status retrieved', response);
    }
    catch (error) {
        winston_1.logger.error('Error fetching job status', error);
        return api_response_1.ApiResponse.serverError(res, 'Failed to fetch job status', error.message);
    }
});
exports.getJobStatusController = getJobStatusController;
