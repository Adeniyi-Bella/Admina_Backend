"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = require("mongoose");
const chatBotHistorySchema = new mongoose_1.Schema({
    userId: {
        type: String,
        required: [true, 'User ID is required'],
    },
    docId: {
        type: String,
        required: [true, 'Document ID is required'],
    },
    translatedText: {
        type: String,
        default: '',
    },
    chats: {
        type: [
            {
                userPrompt: {
                    type: String,
                    required: [true, 'Prompt is required'],
                },
                response: {
                    type: String,
                    required: [true, 'Response is required'],
                },
                time: {
                    type: Date,
                    default: Date.now,
                },
            },
        ],
        default: [],
        _id: false,
    },
}, {
    timestamps: true,
});
exports.default = (0, mongoose_1.model)('ChatBotHistory', chatBotHistorySchema);
