"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = require("mongoose");
const valuesSchema = new mongoose_1.Schema({
    max: { type: Number, default: 0 },
    min: { type: Number, default: 0 },
    current: { type: Number, default: 0 },
}, { _id: false });
const plansSchema = new mongoose_1.Schema({
    premium: { type: valuesSchema },
    standard: { type: valuesSchema },
    free: { type: valuesSchema },
}, { _id: false });
const documentSchema = new mongoose_1.Schema({
    userId: {
        type: String,
        required: [true, 'User ID is required'],
    },
    docId: {
        type: String,
        required: [true, 'Document ID is required'],
    },
    chatBotPrompt: {
        type: plansSchema,
        default: () => ({
            premium: { max: 20, min: 0, current: 20 },
            standard: { max: 10, min: 0, current: 10 },
            free: { max: 5, min: 0, current: 5 },
        }),
    },
    title: {
        type: String,
        default: '',
    },
    sender: {
        type: String,
        default: '',
    },
    receivedDate: {
        type: Date,
    },
    summary: {
        type: String,
        default: '',
    },
    translatedText: {
        type: String,
        default: '',
    },
    pdfBlobStorage: {
        type: Boolean,
        required: true,
    },
    targetLanguage: {
        type: String,
        default: '',
    },
    structuredTranslatedText: {
        type: Map,
        of: String,
        default: {},
    },
    actionPlan: {
        type: [{ title: String, reason: String }],
        default: [],
    },
    actionPlans: {
        type: [
            {
                id: {
                    type: String,
                    required: [true, 'Action Plan ID is required'],
                },
                title: {
                    type: String,
                    default: '',
                },
                dueDate: {
                    type: Date,
                },
                completed: {
                    type: Boolean,
                    default: false,
                },
                location: {
                    type: String,
                    default: '',
                },
            },
        ],
        default: [],
        _id: false,
    },
}, {
    timestamps: true,
});
exports.default = (0, mongoose_1.model)('Document', documentSchema);
