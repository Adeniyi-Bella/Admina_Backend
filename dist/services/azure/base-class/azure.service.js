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
exports.AzureSubscriptionBase = void 0;
const cognitiveservices_computervision_1 = require("@azure/cognitiveservices-computervision");
const ms_rest_js_1 = require("@azure/ms-rest-js");
const winston_1 = require("../../../lib/winston");
const config_1 = __importDefault(require("../../../config"));
class AzureSubscriptionBase {
    constructor() {
        this.pollingIntervalMs = 1000;
        this.maxPollingAttempts = 30;
        const ocrExtractionKey = config_1.default.OCR_TEXT_EXTRACTION_KEY;
        const ocrExtractionEndpoint = config_1.default.OCR_TEXT_EXTRACTION_ENDPOINT;
        if (!ocrExtractionKey || !ocrExtractionEndpoint) {
            winston_1.logger.error('Invalid configuration: Azure Computer Vision key or endpoint missing');
            throw new Error('Azure Computer Vision key and endpoint are required');
        }
        this.client = new cognitiveservices_computervision_1.ComputerVisionClient(new ms_rest_js_1.ApiKeyCredentials({
            inHeader: { 'Ocp-Apim-Subscription-Key': ocrExtractionKey },
        }), ocrExtractionEndpoint);
    }
    sleep(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
    extractTextFromFile(data) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            try {
                if (!((_a = data.file) === null || _a === void 0 ? void 0 : _a.buffer) || !(data.file.buffer instanceof Buffer)) {
                    winston_1.logger.error('Invalid input: A valid document file buffer is required');
                    throw new Error('A valid document file buffer is required');
                }
                if (!data.docLanguage) {
                    winston_1.logger.error('Invalid input: A valid source language is required');
                    throw new Error('A valid source language is required');
                }
                const readResults = yield this.readTextFromStream(data.file.buffer, data.docLanguage);
                const text = this.extractTextFromResults(readResults);
                if (!text) {
                    winston_1.logger.error('No text extracted: The file may not contain readable text');
                    throw new Error('No text was extracted from the file. The file may not contain readable text.');
                }
                return { text };
            }
            catch (error) {
                winston_1.logger.error('Text extraction failed', error.message);
                throw new Error('Internal server error');
            }
        });
    }
    readTextFromStream(buffer, language) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c;
            try {
                const operationResponse = yield this.client.readInStream(buffer, { language });
                const operationId = (_a = operationResponse.operationLocation) === null || _a === void 0 ? void 0 : _a.split('/').pop();
                if (!operationId) {
                    winston_1.logger.error('Failed to retrieve operation ID from Azure Read API response');
                    throw new Error('Internal server error');
                }
                let attempts = 0;
                while (attempts < this.maxPollingAttempts) {
                    const result = yield this.client.getReadResult(operationId);
                    if (result.status === 'succeeded') {
                        return (_c = (_b = result.analyzeResult) === null || _b === void 0 ? void 0 : _b.readResults) !== null && _c !== void 0 ? _c : [];
                    }
                    if (result.status === 'failed') {
                        winston_1.logger.error('Text extraction operation failed');
                        throw new Error('Internal server error');
                    }
                    yield this.sleep(this.pollingIntervalMs);
                    attempts++;
                }
                winston_1.logger.error(`Text extraction timed out after ${this.maxPollingAttempts} attempts`);
                throw new Error('Internal server error');
            }
            catch (error) {
                winston_1.logger.error('Text extraction failed', error.message);
                throw new Error('Internal server error');
            }
        });
    }
    extractTextFromResults(readResults) {
        return readResults
            .flatMap((page) => { var _a, _b; return (_b = (_a = page.lines) === null || _a === void 0 ? void 0 : _a.map((line) => line.words.map((word) => word.text).join(' '))) !== null && _b !== void 0 ? _b : []; })
            .join('\n')
            .trim();
    }
}
exports.AzureSubscriptionBase = AzureSubscriptionBase;
