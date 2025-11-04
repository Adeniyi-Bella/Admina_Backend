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
exports.GeminiAIService = void 0;
const genai_1 = require("@google/genai");
const uuid_1 = require("uuid");
const tsyringe_1 = require("tsyringe");
const winston_1 = require("../../../lib/winston");
const config_1 = __importDefault(require("../../../config"));
const userPrompts_1 = require("../userPrompts");
let GeminiAIService = (() => {
    let _classDecorators = [(0, tsyringe_1.injectable)()];
    let _classDescriptor;
    let _classExtraInitializers = [];
    let _classThis;
    var GeminiAIService = _classThis = class {
        constructor() {
            this.model = 'gemini-2.5-flash';
            this.geminiAi = new genai_1.GoogleGenAI({
                apiKey: config_1.default.GEMINI_API_KEY,
            });
            this.userPrompt = new userPrompts_1.Prompt();
        }
        translateDocument(file, targetLanguage) {
            return __awaiter(this, void 0, void 0, function* () {
                var _a, _b;
                if (!file || !file.buffer) {
                    throw new Error('Valid file is required for translation');
                }
                const userPrompt = this.userPrompt.buildPromptForTranslateDocument(targetLanguage);
                const contents = [
                    { text: userPrompt },
                    {
                        inlineData: {
                            mimeType: file.mimetype,
                            data: file.buffer.toString('base64'),
                        },
                    },
                ];
                try {
                    const response = yield this.geminiAi.models.generateContent({
                        model: this.model,
                        contents,
                    });
                    if (!response) {
                        winston_1.logger.error('Gemini returned empty response', { response });
                        throw new Error('Gemini returned empty response');
                    }
                    const responseText = response.text;
                    if (!responseText) {
                        throw new Error('No text returned from Gemini');
                    }
                    return this.parseResponse(responseText);
                }
                catch (error) {
                    winston_1.logger.error('❌ Gemini document translation failed', {
                        message: error.message,
                        name: error.name,
                        stack: error.stack,
                        cause: error.cause,
                        isNetworkError: (_a = error.message) === null || _a === void 0 ? void 0 : _a.includes('fetch failed'),
                        hint: ((_b = error.message) === null || _b === void 0 ? void 0 : _b.includes('fetch failed'))
                            ? 'Likely a network or API connection issue (check endpoint and key).'
                            : 'Internal Gemini processing error.',
                    });
                    throw new Error(error || 'Gemini document translation failed');
                }
            });
        }
        summarizeDocument(tranlatedText, targetLanguage) {
            return __awaiter(this, void 0, void 0, function* () {
                var _a, _b;
                const userPrompt = this.userPrompt.buildPromptForSummarizeDocument(tranlatedText, targetLanguage);
                try {
                    const contents = [{ text: userPrompt }];
                    const response = yield this.geminiAi.models.generateContent({
                        model: this.model,
                        contents,
                    });
                    const responseText = response.text;
                    if (!responseText) {
                        throw new Error('No response received from Gemini AI');
                    }
                    return this.parseResponse(responseText);
                }
                catch (error) {
                    winston_1.logger.error('❌ Gemini document summarization failed', {
                        message: error.message,
                        name: error.name,
                        stack: error.stack,
                        cause: error.cause,
                        isNetworkError: (_a = error.message) === null || _a === void 0 ? void 0 : _a.includes('fetch failed'),
                        hint: ((_b = error.message) === null || _b === void 0 ? void 0 : _b.includes('fetch failed'))
                            ? 'Likely a network or API connection issue (check endpoint and key).'
                            : 'Internal Gemini processing error.',
                    });
                    throw new Error(error || 'Gemini summarization translation failed');
                }
            });
        }
        parseResponse(response) {
            var _a, _b, _c, _d, _e, _f, _g;
            try {
                const cleanResponse = response
                    .trim()
                    .replace(/^```(?:json)?/i, '')
                    .replace(/```$/, '')
                    .trim();
                const parsed = JSON.parse(cleanResponse);
                return {
                    translatedText: (_a = parsed.translatedText) !== null && _a !== void 0 ? _a : '',
                    structuredTranslatedText: (_b = parsed.structuredTranslatedText) !== null && _b !== void 0 ? _b : {},
                    title: (_c = parsed.title) !== null && _c !== void 0 ? _c : '',
                    sender: (_d = parsed.sender) !== null && _d !== void 0 ? _d : '',
                    receivedDate: (_e = parsed.receivedDate) !== null && _e !== void 0 ? _e : new Date().toISOString(),
                    summary: (_f = parsed.summary) !== null && _f !== void 0 ? _f : '',
                    actionPlan: (_g = parsed.actionPlan) !== null && _g !== void 0 ? _g : [],
                    actionPlans: Array.isArray(parsed.actionPlans)
                        ? parsed.actionPlans.map((item) => {
                            var _a, _b, _c, _d;
                            return ({
                                id: (0, uuid_1.v4)(),
                                title: (_a = item.title) !== null && _a !== void 0 ? _a : '',
                                dueDate: (_b = item.due_date) !== null && _b !== void 0 ? _b : new Date().toISOString(),
                                completed: (_c = item.completed) !== null && _c !== void 0 ? _c : false,
                                location: (_d = item.location) !== null && _d !== void 0 ? _d : '',
                            });
                        })
                        : [],
                };
            }
            catch (error) {
                winston_1.logger.error('Failed to parse OpenAI response', {
                    response,
                    error: error,
                });
                throw error;
            }
        }
    };
    __setFunctionName(_classThis, "GeminiAIService");
    (() => {
        const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
        GeminiAIService = _classThis = _classDescriptor.value;
        if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return GeminiAIService = _classThis;
})();
exports.GeminiAIService = GeminiAIService;
