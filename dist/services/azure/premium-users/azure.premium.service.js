"use strict";
var __esDecorate = (this && this.__esDecorate) || function (ctor, descriptorIn, decorators, contextIn, initializers, extraInitializers) {
    function accept(f) { if (f !== void 0 && typeof f !== "function") throw new TypeError("Function expected"); return f; }
    var kind = contextIn.kind, key = kind === "getter" ? "get" : kind === "setter" ? "set" : "value";
    var target = !descriptorIn && ctor ? contextIn["static"] ? ctor : ctor.prototype : null;
    var descriptor = descriptorIn || (target ? Object.getOwnPropertyDescriptor(target, contextIn.name) : {});
    var _, done = false;
    for (var i = decorators.length - 1; i >= 0; i--) {
        var context = {};
        for (var p in contextIn) context[p] = p === "access" ? {} : contextIn[p];
        for (var p in contextIn.access) context.access[p] = contextIn.access[p];
        context.addInitializer = function (f) { if (done) throw new TypeError("Cannot add initializers after decoration has completed"); extraInitializers.push(accept(f || null)); };
        var result = (0, decorators[i])(kind === "accessor" ? { get: descriptor.get, set: descriptor.set } : descriptor[key], context);
        if (kind === "accessor") {
            if (result === void 0) continue;
            if (result === null || typeof result !== "object") throw new TypeError("Object expected");
            if (_ = accept(result.get)) descriptor.get = _;
            if (_ = accept(result.set)) descriptor.set = _;
            if (_ = accept(result.init)) initializers.unshift(_);
        }
        else if (_ = accept(result)) {
            if (kind === "field") initializers.unshift(_);
            else descriptor[key] = _;
        }
    }
    if (target) Object.defineProperty(target, contextIn.name, descriptor);
    done = true;
};
var __runInitializers = (this && this.__runInitializers) || function (thisArg, initializers, value) {
    var useValue = arguments.length > 2;
    for (var i = 0; i < initializers.length; i++) {
        value = useValue ? initializers[i].call(thisArg, value) : initializers[i].call(thisArg);
    }
    return useValue ? value : void 0;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __setFunctionName = (this && this.__setFunctionName) || function (f, name, prefix) {
    if (typeof name === "symbol") name = name.description ? "[".concat(name.description, "]") : "";
    return Object.defineProperty(f, "name", { configurable: true, value: prefix ? "".concat(prefix, " ", name) : name });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AzurePremiumSubscriptionService = void 0;
const tsyringe_1 = require("tsyringe");
const uuid_1 = require("uuid");
const storage_blob_1 = require("@azure/storage-blob");
const tsyringe_2 = require("tsyringe");
const config_1 = __importDefault(require("../../../config"));
const winston_1 = require("../../../lib/winston");
const axios_1 = __importDefault(require("axios"));
const azure_service_1 = require("../base-class/azure.service");
const utils_1 = require("../utils");
let AzurePremiumSubscriptionService = (() => {
    let _classDecorators = [(0, tsyringe_1.injectable)()];
    let _classDescriptor;
    let _classExtraInitializers = [];
    let _classThis;
    let _classSuper = azure_service_1.AzureSubscriptionBase;
    var AzurePremiumSubscriptionService = _classThis = class extends _classSuper {
        constructor() {
            super();
            this.containerNameForUpload = 'upload';
            this.containerNameForDownload = 'download';
            this.azureBlobService = tsyringe_2.container.resolve('IAzureBlobService');
            const connectionString = config_1.default.AZURE_STORAGE_ACCOUNT_CONNECTION_STRING;
            this.blobServiceClient =
                storage_blob_1.BlobServiceClient.fromConnectionString(connectionString);
            const accountName = config_1.default.AZURE_STORAGE_ACCOUNT_NAME;
            const accountKey = config_1.default.AZURE_STORAGE_ACCOUNT_KEY;
            this.sharedKeyCredential = new storage_blob_1.StorageSharedKeyCredential(accountName, accountKey);
        }
        translateDocument(userId, blobName, targetLanguage) {
            return __awaiter(this, void 0, void 0, function* () {
                try {
                    const premiumTranslateKey = config_1.default.PREMIUM_PLAN_TRANSLATE_KEY;
                    const premiumTranslateEndpoint = config_1.default.PREMIUM_PLAN_TRANSLATE_ENDPOINT;
                    const containerClient = this.blobServiceClient.getContainerClient(this.containerNameForUpload);
                    const blockBlobClient = containerClient.getBlockBlobClient(blobName);
                    const sourceSasPermissions = new storage_blob_1.BlobSASPermissions();
                    sourceSasPermissions.read = true;
                    const sourceSas = (0, storage_blob_1.generateBlobSASQueryParameters)({
                        containerName: this.containerNameForUpload,
                        blobName,
                        permissions: sourceSasPermissions,
                        startsOn: new Date(),
                        expiresOn: new Date(new Date().valueOf() + 3600 * 1000),
                        protocol: storage_blob_1.SASProtocol.HttpsAndHttp,
                    }, this.sharedKeyCredential).toString();
                    const sourceUrl = `${blockBlobClient.url}?${sourceSas}`;
                    const targetContainerClient = this.blobServiceClient.getContainerClient(this.containerNameForDownload);
                    yield targetContainerClient.createIfNotExists({ access: 'container' });
                    const targetSasPermissions = new storage_blob_1.BlobSASPermissions();
                    targetSasPermissions.write = true;
                    targetSasPermissions.read = true;
                    const targetSas = (0, storage_blob_1.generateBlobSASQueryParameters)({
                        containerName: this.containerNameForDownload,
                        permissions: targetSasPermissions,
                        startsOn: new Date(),
                        expiresOn: new Date(new Date().valueOf() + 3600 * 1000),
                        protocol: storage_blob_1.SASProtocol.HttpsAndHttp,
                    }, this.sharedKeyCredential).toString();
                    const userBlobName = `${userId}/${blobName}`;
                    const targetUrl = `${targetContainerClient.url}/${userBlobName}?${targetSas}`;
                    const postResponse = yield axios_1.default.post(`${premiumTranslateEndpoint}translator/document/batches?api-version=2024-05-01`, {
                        inputs: [
                            {
                                storageType: 'File',
                                source: { sourceUrl, storageSource: 'AzureBlob' },
                                targets: [
                                    {
                                        targetUrl,
                                        storageSource: 'AzureBlob',
                                        category: 'general',
                                        language: targetLanguage,
                                    },
                                ],
                            },
                        ],
                    }, {
                        headers: {
                            'Ocp-Apim-Subscription-Key': premiumTranslateKey,
                            'Content-Type': 'application/json',
                        },
                        validateStatus: () => true,
                    });
                    const operationLocation = postResponse.headers['operation-location'];
                    if (!operationLocation) {
                        winston_1.logger.error('No operation-location returned by Azure');
                        throw new Error('Internal server error');
                    }
                    let isCompleted = false;
                    let attempts = 0;
                    const maxAttempts = 30;
                    const delay = (ms) => new Promise((res) => setTimeout(res, ms));
                    while (!isCompleted && attempts < maxAttempts) {
                        const pollResponse = yield axios_1.default.get(operationLocation, {
                            headers: {
                                'Ocp-Apim-Subscription-Key': premiumTranslateKey,
                            },
                        });
                        const status = pollResponse.data.status;
                        if (status === 'Succeeded') {
                            isCompleted = true;
                            yield this.azureBlobService.deleteBlob(this.containerNameForUpload, blobName);
                            break;
                        }
                        else if (status === 'Failed' || status === 'ValidationFailed') {
                            throw new Error(`Translation failed with status: ${status}`);
                        }
                        attempts++;
                        yield delay(5000);
                    }
                    if (!isCompleted) {
                        throw new Error('Translation did not complete within expected time');
                    }
                    winston_1.logger.info('Translation completed successfully for blob:', { blobName });
                    return true;
                }
                catch (error) {
                    winston_1.logger.error('Error translating document', { error: error.message });
                    throw new Error('Internal server error');
                }
            });
        }
        processPremiumUserDocument(params) {
            return __awaiter(this, void 0, void 0, function* () {
                const { file, docLanguage, targetLanguage, res, openAIService, userId, documentService, userService, chatBotService, } = params;
                if (!(file === null || file === void 0 ? void 0 : file.buffer) || !(file.buffer instanceof Buffer)) {
                    winston_1.logger.error('Invalid input: A valid document file buffer is required', {
                        userId,
                    });
                    throw new Error('A valid document file buffer is required');
                }
                this.translatedPdfBuffer = undefined;
                (0, utils_1.sendSseMessage)(res, 'message', 'Uploading document...');
                const docId = (0, uuid_1.v4)();
                yield (0, utils_1.handleSseAsyncOperation)(res, () => this.azureBlobService.uploadPdfToBlob(this.containerNameForUpload, file, docId), 'Failed to upload PDF');
                (0, utils_1.sendSseMessage)(res, 'uploaded', { status: 'Document uploaded' });
                const isDocumentTranslated = yield (0, utils_1.handleSseAsyncOperation)(res, () => this.translateDocument(userId, docId, targetLanguage), 'Failed to translate document');
                (0, utils_1.sendSseMessage)(res, 'translated', { status: 'Document translated' });
                if (isDocumentTranslated) {
                    this.translatedPdfBuffer = yield (0, utils_1.handleSseAsyncOperation)(res, () => this.azureBlobService.downloadPdfFromBlob(this.containerNameForDownload, `${userId}/${docId}`), 'Failed to download translated PDF');
                    (0, utils_1.sendSseMessage)(res, 'downloaded', {
                        status: 'Translated document downloaded',
                    });
                }
                else {
                    winston_1.logger.error('Document translation not completed', { userId, docId });
                    throw new Error('Internal server error');
                }
                if (!this.translatedPdfBuffer) {
                    winston_1.logger.error('Translated PDF buffer not available', { userId, docId });
                    throw new Error('Internal server error');
                }
                const extractedText = yield (0, utils_1.handleSseAsyncOperation)(res, () => this.extractTextFromFile({
                    file: this.translatedPdfBuffer,
                    docLanguage,
                    plan: 'premium',
                }), 'Failed to extract text from translated document');
                (0, utils_1.sendSseMessage)(res, 'extractedText', { extractedText: extractedText.text });
                yield chatBotService.addTranslatedText({
                    userId: userId.toString(),
                    docId,
                    translatedText: extractedText.text,
                });
                const summarizedText = yield (0, utils_1.handleSseAsyncOperation)(res, () => openAIService.summarizeTranslatedText(extractedText.text, targetLanguage), 'Failed to summarize translated text');
                (0, utils_1.sendSseMessage)(res, 'summarizedText', { summarizedText });
                if (!summarizedText.summary || summarizedText.summary.includes('Failed')) {
                    winston_1.logger.error('Invalid summary generated', { userId, docId });
                    throw new Error('Failed to generate valid summary');
                }
                const documentData = {
                    userId: userId.toString(),
                    docId,
                    title: summarizedText.title || '',
                    sender: summarizedText.sender || '',
                    receivedDate: summarizedText.receivedDate || new Date(),
                    summary: summarizedText.summary || '',
                    targetLanguage,
                    actionPlan: summarizedText.actionPlan || [],
                    actionPlans: (summarizedText.actionPlans || []).map((plan) => {
                        var _a;
                        return ({
                            id: plan.id || (0, uuid_1.v4)(),
                            title: plan.title || '',
                            dueDate: plan.dueDate || new Date(),
                            completed: (_a = plan.completed) !== null && _a !== void 0 ? _a : false,
                            location: plan.location || '',
                        });
                    }),
                    pdfBlobStorage: true
                };
                const documentCreated = yield (0, utils_1.handleSseAsyncOperation)(res, () => documentService.createDocumentByUserId(documentData), 'Failed to create document in MongoDB');
                (0, utils_1.sendSseMessage)(res, 'createdDocument', {
                    status: 'Document created in MongoDB',
                });
                yield (0, utils_1.handleSseAsyncOperation)(res, () => userService.updateUser(userId, 'lengthOfDocs.premium.current', true, undefined), 'Failed to update lengthOfDocs for user');
                (0, utils_1.sendSseMessage)(res, 'complete', { document: documentCreated.summary });
                this.translatedPdfBuffer = undefined;
            });
        }
    };
    __setFunctionName(_classThis, "AzurePremiumSubscriptionService");
    (() => {
        var _a;
        const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create((_a = _classSuper[Symbol.metadata]) !== null && _a !== void 0 ? _a : null) : void 0;
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
        AzurePremiumSubscriptionService = _classThis = _classDescriptor.value;
        if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return AzurePremiumSubscriptionService = _classThis;
})();
exports.AzurePremiumSubscriptionService = AzurePremiumSubscriptionService;
