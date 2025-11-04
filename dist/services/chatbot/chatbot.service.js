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
exports.ChatBotService = void 0;
const chatbotHistory_model_1 = __importDefault(require("../../models/chatbotHistory.model"));
const tsyringe_1 = require("tsyringe");
const winston_1 = require("../../lib/winston");
let ChatBotService = (() => {
    let _classDecorators = [(0, tsyringe_1.injectable)()];
    let _classDescriptor;
    let _classExtraInitializers = [];
    let _classThis;
    var ChatBotService = _classThis = class {
        getDocumentChatBotCollection(userId, docId) {
            return __awaiter(this, void 0, void 0, function* () {
                try {
                    if (!userId || !docId) {
                        throw new Error('User ID and Document ID are required');
                    }
                    const result = yield chatbotHistory_model_1.default.findOne({
                        userId,
                        docId,
                    })
                        .select('-__v')
                        .lean()
                        .exec();
                    return result;
                }
                catch (error) {
                    winston_1.logger.error('Failed to retrieve chat history collection', {
                        error,
                        userId,
                        docId,
                    });
                    throw new Error(`Failed to retrieve chat history collection: ${error}`);
                }
            });
        }
        updateDocumentChatBotHistory(userId, docId, chat) {
            return __awaiter(this, void 0, void 0, function* () {
                try {
                    if (!userId || !docId || !chat || !chat.userPrompt || !chat.response) {
                        throw new Error('User ID, Document ID, and valid chat data are required');
                    }
                    const result = yield chatbotHistory_model_1.default.findOneAndUpdate({ userId, docId }, { $push: { chats: chat } }, { new: true })
                        .select('-__v')
                        .lean()
                        .exec();
                    if (!result) {
                        throw new Error('Chat history collection not found for update');
                    }
                    winston_1.logger.info('Chat history collection updated successfully', {
                        userId,
                        docId,
                    });
                }
                catch (error) {
                    winston_1.logger.error('Failed to update chat history collection', {
                        error,
                        userId,
                        docId,
                    });
                    throw new Error(`Failed to update chat history collection: ${error}`);
                }
            });
        }
        addTranslatedText(chatBotHistory) {
            return __awaiter(this, void 0, void 0, function* () {
                try {
                    if (!chatBotHistory || !chatBotHistory.userId || !chatBotHistory.docId) {
                        throw new Error('Valid chat history data is required');
                    }
                    yield chatbotHistory_model_1.default.create(chatBotHistory);
                    const result = yield chatbotHistory_model_1.default.findOne({
                        userId: chatBotHistory.userId,
                        docId: chatBotHistory.docId,
                    })
                        .select('-__v')
                        .lean()
                        .exec();
                    if (!result) {
                        throw new Error('Failed to retrieve New chat history collection');
                    }
                    return result;
                }
                catch (error) {
                    winston_1.logger.error('Failed to create chat history collection', {
                        error: error,
                    });
                    throw new Error(`Failed to create chat history collection: ${error}`);
                }
            });
        }
        deleteChatHistoryByUserId(userId) {
            return __awaiter(this, void 0, void 0, function* () {
                try {
                    if (!userId) {
                        throw new Error('User ID is required');
                    }
                    yield chatbotHistory_model_1.default.deleteMany({ userId }).exec();
                    winston_1.logger.info('Chat history deleted successfully', { userId });
                    return true;
                }
                catch (error) {
                    winston_1.logger.error('Failed to delete chat history', { error, userId });
                    throw new Error(`Failed to delete chat history: ${error}`);
                }
            });
        }
        deleteChatHistoryByDocument(userId, docId) {
            return __awaiter(this, void 0, void 0, function* () {
                try {
                    if (!userId || !docId) {
                        throw new Error('User ID is required');
                    }
                    const result = yield chatbotHistory_model_1.default.deleteMany({ userId, docId }).exec();
                    if (result.deletedCount === 0) {
                        winston_1.logger.info('No chat history found for user', { userId, docId });
                    }
                    winston_1.logger.info('Chat history deleted successfully', { userId, docId });
                    return true;
                }
                catch (error) {
                    winston_1.logger.error('Failed to delete chat history', { error, userId });
                    throw new Error(`Failed to delete chat history: ${error}`);
                }
            });
        }
    };
    __setFunctionName(_classThis, "ChatBotService");
    (() => {
        const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
        ChatBotService = _classThis = _classDescriptor.value;
        if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return ChatBotService = _classThis;
})();
exports.ChatBotService = ChatBotService;
