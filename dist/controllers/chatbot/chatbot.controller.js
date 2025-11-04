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
var __asyncValues = (this && this.__asyncValues) || function (o) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var m = o[Symbol.asyncIterator], i;
    return m ? m.call(o) : (o = typeof __values === "function" ? __values(o) : o[Symbol.iterator](), i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function () { return this; }, i);
    function verb(n) { i[n] = o[n] && function (v) { return new Promise(function (resolve, reject) { v = o[n](v), settle(resolve, reject, v.done, v.value); }); }; }
    function settle(resolve, reject, d, v) { Promise.resolve(v).then(function(v) { resolve({ value: v, done: d }); }, reject); }
};
Object.defineProperty(exports, "__esModule", { value: true });
const tsyringe_1 = require("tsyringe");
const winston_1 = require("../../lib/winston");
const api_response_1 = require("../../lib/api_response");
const adminaChatBot = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, e_1, _b, _c;
    var _d, _e, _f, _g, _h;
    const chatBotService = tsyringe_1.container.resolve('IChatBotService');
    const userService = tsyringe_1.container.resolve('IUserService');
    const openAiService = tsyringe_1.container.resolve('IOpenAIService');
    const documentService = tsyringe_1.container.resolve('IDocumentService');
    try {
        const { userPrompt } = req.body;
        const userId = req.userId;
        const docId = req.params.docId;
        const user = yield userService.checkIfUserExist(req);
        if (!user) {
            winston_1.logger.error('User does not have a premium plan or user can no longer use the chatbot for the current month', { userId });
            api_response_1.ApiResponse.badRequest(res, 'User does not have a premium plan or user can no longer use the chatbot for the current month');
            return;
        }
        const document = yield documentService.getDocument(user, docId);
        if (!document) {
            winston_1.logger.error('Document does not exist', { userId });
            api_response_1.ApiResponse.badRequest(res, 'Document does not exist');
            return;
        }
        let chatHistory = yield chatBotService.getDocumentChatBotCollection(userId, docId);
        if (!chatHistory) {
            const newChatHistory = {
                userId,
                docId,
                translatedText: document.translatedText,
                chats: [],
                createdAt: new Date(),
                updatedAt: new Date(),
            };
            chatHistory = yield chatBotService.addTranslatedText(newChatHistory);
            winston_1.logger.info('Created new ChatBotHistory', { userId, docId });
        }
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.setHeader('Transfer-Encoding', 'chunked');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.flushHeaders();
        let completeResponse = '';
        const stream = yield openAiService.chatBotStream(chatHistory, userPrompt);
        try {
            for (var _j = true, stream_1 = __asyncValues(stream), stream_1_1; stream_1_1 = yield stream_1.next(), _a = stream_1_1.done, !_a; _j = true) {
                _c = stream_1_1.value;
                _j = false;
                const chunk = _c;
                if ((_e = (_d = chunk.choices[0]) === null || _d === void 0 ? void 0 : _d.delta) === null || _e === void 0 ? void 0 : _e.content) {
                    const content = (_h = (_g = (_f = chunk.choices) === null || _f === void 0 ? void 0 : _f[0]) === null || _g === void 0 ? void 0 : _g.delta) === null || _h === void 0 ? void 0 : _h.content;
                    completeResponse += content;
                    res.write(content);
                }
            }
        }
        catch (e_1_1) { e_1 = { error: e_1_1 }; }
        finally {
            try {
                if (!_j && !_a && (_b = stream_1.return)) yield _b.call(stream_1);
            }
            finally { if (e_1) throw e_1.error; }
        }
        yield documentService.updateDocument(userId, docId, {
            $inc: { [`chatBotPrompt.${user.plan}.current`]: -1 },
        });
        const newChat = {
            userPrompt,
            response: completeResponse,
            time: new Date(),
        };
        yield chatBotService.updateDocumentChatBotHistory(userId, docId, newChat);
        res.end();
    }
    catch (err) {
        api_response_1.ApiResponse.serverError(res, 'Internal server error', err.message);
        winston_1.logger.error('Error during chatbot interaction', {
            userId: req.userId,
            docId: req.params.docId,
            error: err.message,
        });
    }
});
exports.default = adminaChatBot;
