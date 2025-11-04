"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tsyringe_1 = require("tsyringe");
const user_service_1 = require("../services/users/user.service");
const document_service_1 = require("../services/document/document.service");
const openai_service_1 = require("../services/ai-models/openai/openai.service");
const azure_premium_service_1 = require("../services/azure/premium-users/azure.premium.service");
const chatbot_service_1 = require("../services/chatbot/chatbot.service");
const azure_blobStorage_service_1 = require("../services/azure/azure-blob-storage/azure.blobStorage.service");
const geminiai_service_1 = require("../services/ai-models/gemini-ai/geminiai.service");
tsyringe_1.container.register('IUserService', {
    useClass: user_service_1.UserService,
});
tsyringe_1.container.register('IDocumentService', {
    useClass: document_service_1.DocumentService,
});
tsyringe_1.container.register('IGeminiAIService', {
    useClass: geminiai_service_1.GeminiAIService,
});
tsyringe_1.container.register('IAzurePremiumSubscriptionService', {
    useClass: azure_premium_service_1.AzurePremiumSubscriptionService,
});
tsyringe_1.container.register('IOpenAIService', {
    useClass: openai_service_1.OpenAIService,
});
tsyringe_1.container.register('IChatBotService', {
    useClass: chatbot_service_1.ChatBotService,
});
tsyringe_1.container.register('IAzureBlobService', {
    useClass: azure_blobStorage_service_1.AzureBlobService,
});
