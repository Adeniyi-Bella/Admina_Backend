"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = require("mongoose");
const valuesSchema = new mongoose_1.Schema({
    max: { type: Number, default: 0, min: 0 },
    min: { type: Number, default: 0, min: 0 },
    current: { type: Number, default: 0, min: 0 },
}, { _id: false });
const plansSchema = new mongoose_1.Schema({
    premium: {
        type: valuesSchema,
        default: { max: 5, min: 0, current: 5 },
    },
    standard: {
        type: valuesSchema,
        default: { max: 3, min: 0, current: 3 },
    },
    free: {
        type: valuesSchema,
        default: { max: 2, min: 0, current: 2 },
    },
}, { _id: false });
const userSchema = new mongoose_1.Schema({
    plan: {
        type: String,
        default: "free"
    },
    email: {
        type: String,
        required: [true, 'Email is required'],
        unique: [true, 'Email must be unique'],
    },
    username: {
        type: String,
        required: [true, 'Username is required'],
    },
    lengthOfDocs: {
        type: plansSchema,
        default: {
            premium: { max: 7, min: 0, current: 7 },
            standard: { max: 5, min: 0, current: 5 },
            free: { max: 2, min: 0, current: 2 },
        },
    },
    userId: {
        type: String,
        required: [true, 'userId is required'],
    },
}, {
    timestamps: true,
    strict: true,
});
exports.default = (0, mongoose_1.model)('User', userSchema);
