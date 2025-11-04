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
exports.OpenAIService = void 0;
const openai_1 = require("openai");
const uuid_1 = require("uuid");
const tsyringe_1 = require("tsyringe");
const winston_1 = require("../../lib/winston");
const config_1 = __importDefault(require("../../config"));
const userPrompts_1 = require("./userPrompts");
let OpenAIService = (() => {
    let _classDecorators = [(0, tsyringe_1.injectable)()];
    let _classDescriptor;
    let _classExtraInitializers = [];
    let _classThis;
    var OpenAIService = _classThis = class {
        constructor() {
            const apiKey = config_1.default.OPENAI_API_KEY;
            if (!apiKey) {
                throw new Error('OPENAI_API_VALUE must be set in environment variables');
            }
            this.openai = new openai_1.OpenAI({ apiKey });
            this.userPrompt = new userPrompts_1.Prompt();
        }
        chatBotStream(chatBotHistory, userPrompt) {
            return __awaiter(this, void 0, void 0, function* () {
                try {
                    const messages = this.userPrompt.buildChatBotPrompt(chatBotHistory, userPrompt);
                    const stream = yield this.openai.chat.completions.create({
                        model: 'gpt-4.1',
                        messages,
                        stream: true,
                        temperature: 0.3,
                    });
                    return stream;
                }
                catch (error) {
                    winston_1.logger.error('Error initiating chatbot stream', {
                        error,
                        userId: chatBotHistory.userId,
                        docId: chatBotHistory.docId,
                    });
                    throw error;
                }
            });
        }
        structureText(text, label) {
            return __awaiter(this, void 0, void 0, function* () {
                var _a, _b, _c;
                try {
                    const response = yield this.openai.chat.completions.create({
                        model: 'gpt-4.1',
                        temperature: 0.3,
                        messages: [
                            {
                                role: 'user',
                                content: this.userPrompt.structureTextPrompt(text, label),
                            },
                        ],
                    });
                    const summary = ((_c = (_b = (_a = response.choices[0]) === null || _a === void 0 ? void 0 : _a.message) === null || _b === void 0 ? void 0 : _b.content) === null || _c === void 0 ? void 0 : _c.trim()) ||
                        'No summary generated.';
                    return summary;
                }
                catch (error) {
                    winston_1.logger.error('Error in structureText', {
                        error: error.message,
                        text,
                        label,
                    });
                    throw error;
                }
            });
        }
        summarizeTranslatedText(translatedText, targetLanguage) {
            return __awaiter(this, void 0, void 0, function* () {
                var _a, _b;
                if (!translatedText || typeof translatedText !== 'string') {
                    throw new Error('Valid original text is required');
                }
                if (!targetLanguage || typeof targetLanguage !== 'string') {
                    throw new Error('Valid target language is required');
                }
                const userPrompt = this.userPrompt.buildPrompt(translatedText, targetLanguage);
                try {
                    const completion = yield this.openai.chat.completions.create({
                        model: 'gpt-4.1',
                        temperature: 0.3,
                        messages: [{ role: 'user', content: userPrompt }],
                    });
                    const response = (_b = (_a = completion.choices[0]) === null || _a === void 0 ? void 0 : _a.message) === null || _b === void 0 ? void 0 : _b.content;
                    if (!response) {
                        throw new Error('No response received from OpenAI');
                    }
                    return this.parseResponse(response);
                }
                catch (error) {
                    winston_1.logger.error('Failed to generate action plan', {
                        error: error,
                        translatedText,
                        targetLanguage,
                    });
                    return this.getDefaultResponse();
                }
            });
        }
        parseResponse(response) {
            try {
                const parsed = JSON.parse(response);
                if (!parsed.title || typeof parsed.title !== 'string') {
                    parsed.title = '';
                }
                if (!parsed.sender || typeof parsed.sender !== 'string') {
                    parsed.sender = '';
                }
                if (!parsed.summary || typeof parsed.summary !== 'string') {
                    parsed.summary = '';
                }
                const receivedDate = parsed.receivedDate && !isNaN(new Date(parsed.receivedDate).getTime())
                    ? new Date(parsed.receivedDate)
                    : new Date();
                const actionPlan = Array.isArray(parsed.actionPlan)
                    ? parsed.actionPlan.map((item) => ({
                        title: typeof item.title === 'string' ? item.title : '',
                        reason: typeof item.reason === 'string' ? item.reason : '',
                    }))
                    : [];
                const actionPlans = Array.isArray(parsed.actionPlans)
                    ? parsed.actionPlans.map((item) => ({
                        id: (0, uuid_1.v4)(),
                        title: typeof item.title === 'string' ? item.title : '',
                        dueDate: item.due_date && !isNaN(new Date(item.due_date).getTime())
                            ? new Date(item.due_date)
                            : new Date(),
                        completed: typeof item.completed === 'boolean' ? item.completed : false,
                        location: typeof item.location === 'string' ? item.location : '',
                    }))
                    : [];
                return {
                    title: parsed.title,
                    sender: parsed.sender,
                    receivedDate,
                    summary: parsed.summary,
                    actionPlan,
                    actionPlans,
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
        getDefaultResponse() {
            return {
                title: '',
                sender: '',
                receivedDate: new Date(),
                summary: 'Failed to generate action plan. Please try again later.',
                actionPlan: [],
                actionPlans: [],
            };
        }
    };
    __setFunctionName(_classThis, "OpenAIService");
    (() => {
        const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
        OpenAIService = _classThis = _classDescriptor.value;
        if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return OpenAIService = _classThis;
})();
exports.OpenAIService = OpenAIService;
