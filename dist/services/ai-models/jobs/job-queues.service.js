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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TranslateQueueService = void 0;
const redis_1 = __importDefault(require("../../../lib/redis"));
const tsyringe_1 = require("tsyringe");
const uuid_1 = require("uuid");
const winston_1 = require("../../../lib/winston");
class TranslateQueueService {
    constructor() {
        this.concurrency = 5;
        this.activeCount = 0;
        this.queue = [];
        this.geminiService =
            tsyringe_1.container.resolve('IGeminiAIService');
        this.documentService =
            tsyringe_1.container.resolve('IDocumentService');
        this.userService = tsyringe_1.container.resolve('IUserService');
    }
    isUserProcessing(email) {
        return TranslateQueueService.processingUsers.has(email);
    }
    addUserToProcessing(email) {
        TranslateQueueService.processingUsers.add(email);
    }
    removeUserFromProcessing(email) {
        TranslateQueueService.processingUsers.delete(email);
    }
    enqueueTranslationJob(docId, data) {
        return __awaiter(this, void 0, void 0, function* () {
            const jobKey = `job:${docId}`;
            yield redis_1.default.hmset(jobKey, { docId, status: 'queued' });
            yield redis_1.default.expire(jobKey, 60 * 60);
            this.queue.push({ docId, data });
            this.processQueue();
        });
    }
    processQueue() {
        return __awaiter(this, void 0, void 0, function* () {
            while (this.activeCount < this.concurrency && this.queue.length > 0) {
                const { docId, data } = this.queue.shift();
                this.activeCount++;
                this.runJob(docId, data)
                    .catch((err) => console.error(`Job ${docId} encountered error`, err))
                    .finally(() => {
                    this.activeCount--;
                    this.processQueue();
                });
            }
        });
    }
    runJob(docId, data) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            const jobKey = `job:${docId}`;
            yield redis_1.default.hset(jobKey, 'status', 'translate');
            try {
                const translatedDocument = yield this.geminiService.translateDocument(data.file, data.targetLanguage);
                yield redis_1.default.hset(jobKey, 'status', 'summarize');
                const summarizedTextDocument = yield this.geminiService.summarizeDocument(translatedDocument.translatedText, data.targetLanguage);
                const documentData = {
                    title: summarizedTextDocument.title || '',
                    sender: summarizedTextDocument.sender || '',
                    receivedDate: summarizedTextDocument.receivedDate || new Date(),
                    summary: summarizedTextDocument.summary || '',
                    actionPlan: summarizedTextDocument.actionPlan || [],
                    actionPlans: (summarizedTextDocument.actionPlans || []).map((plan) => ({
                        id: plan.id || (0, uuid_1.v4)(),
                        title: plan.title || '',
                        dueDate: plan.dueDate || new Date(),
                        completed: false,
                        location: plan.location || '',
                    })),
                    userId: data.user.userId.toString(),
                    docId,
                    translatedText: translatedDocument.translatedText,
                    structuredTranslatedText: translatedDocument.structuredTranslatedText,
                    targetLanguage: data.targetLanguage,
                    pdfBlobStorage: false,
                };
                yield this.documentService.createDocumentByUserId(documentData);
                let isUpdatedLengthOfDoc;
                if (data.user.plan === 'free') {
                    isUpdatedLengthOfDoc = yield this.userService.updateUser(data.user.userId, 'lengthOfDocs.free.current', true, undefined);
                }
                else if (data.user.plan === 'standard') {
                    isUpdatedLengthOfDoc = yield this.userService.updateUser(data.user.userId, 'lengthOfDocs.standard.current', true, undefined);
                }
                if (!isUpdatedLengthOfDoc) {
                    throw new Error('User plan could not be updated');
                }
                yield redis_1.default.hset(jobKey, 'status', 'completed');
            }
            catch (err) {
                winston_1.logger.error('Error during document processing', {
                    error: err,
                });
                yield redis_1.default.hmset(jobKey, {
                    status: 'error',
                    error: (_a = err.message) !== null && _a !== void 0 ? _a : 'Unknown error',
                });
            }
            finally {
                this.removeUserFromProcessing(data.user.email);
            }
        });
    }
    getJobStatus(docId) {
        return __awaiter(this, void 0, void 0, function* () {
            const jobKey = `job:${docId}`;
            const job = yield redis_1.default.hgetall(jobKey);
            if (!job || Object.keys(job).length === 0)
                return null;
            return {
                docId: job.docId,
                status: job.status,
                error: job.error,
            };
        });
    }
}
exports.TranslateQueueService = TranslateQueueService;
TranslateQueueService.processingUsers = new Set();
