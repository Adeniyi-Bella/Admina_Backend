"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const config = {
    PORT: process.env.PORT || 8080,
    WHITELIST_ORIGINS: process.env.WHITELIST_ORIGINS,
    NODE_ENV: process.env.NODE_ENV,
    MONGO_URI: process.env.MONGO_URI,
    LOG_LEVEL: process.env.LOG_LEVEL || 'info',
    AZURE_TENANT_ID: process.env.AZURE_TENANT_ID,
    AZURE_CLIENT_ID: process.env.AZURE_CLIENT_ID,
    ADMINA_API_CLIENT_ID: process.env.ADMINA_API_CLIENT_ID,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    defaultResLimit: 20,
    defaultResOffset: 0,
    AZURE_CLIENT_SECRETE: process.env.AZURE_CLIENT_SECRETE,
    AZURE_CLIENT_AUTHORITY: process.env.AZURE_CLIENT_AUTHORITY,
    LOGTAIL_SOURCE_TOKEN: process.env.LOGTAIL_SOURCE_TOKEN,
    LOG_TAIL_INGESTING_HOST: process.env.LOG_TAIL_INGESTING_HOST,
    GEMINI_API_KEY: process.env.GEMINI_API_KEY,
};
exports.default = config;
