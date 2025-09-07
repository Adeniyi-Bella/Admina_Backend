/**
 * @copyright 2025 Adeniyi Bella
 * @license Apache-2.0
 */

/**
 * Node modules
 */
import { container } from 'tsyringe';

/**
 * Services and their Interfaces
 */
import { UserService } from '@/services/users/user.service';
import { DocumentService } from '@/services/document/document.service';
// import { AzureFreeSubscriptionService } from '@/services/azure/free-users/azure.free.service';
import { OpenAIService } from '@/services/ai-models/openai/openai.service';
import { IUserService } from '@/services/users/user.interface';
import { IDocumentService } from '@/services/document/document.interface';
// import { IAzureFreeSubscriptionService } from '@/services/azure/free-users/azure.free.interface';
import { IOpenAIService } from '@/services/ai-models/openai.interface';
import { IAzurePremiumSubscriptionService } from '@/services/azure/premium-users/azure.premium.interface';
import { AzurePremiumSubscriptionService } from '@/services/azure/premium-users/azure.premium.service';
import { IChatBotService } from '@/services/chatbot/chatbot.interface';
import { ChatBotService } from '@/services/chatbot/chatbot.service';
import { IAzureBlobService } from '@/services/azure/azure-blob-storage/azure.blobStorage.interface';
import { AzureBlobService } from '@/services/azure/azure-blob-storage/azure.blobStorage.service';
import { IGeminiAIService } from '@/services/ai-models/gemini-ai/geminiai.interface';
import { GeminiAIService } from '@/services/ai-models/gemini-ai/geminiai.service';


// Register the interface with its implementation
container.register<IUserService>('IUserService', {
  useClass: UserService,
});
container.register<IDocumentService>('IDocumentService', {
  useClass: DocumentService,
});
container.register<IGeminiAIService>('IGeminiAIService', {
  useClass: GeminiAIService,
});
container.register<IAzurePremiumSubscriptionService>('IAzurePremiumSubscriptionService', {
  useClass: AzurePremiumSubscriptionService,
});
container.register<IOpenAIService>('IOpenAIService', {
  useClass: OpenAIService,
});
container.register<IChatBotService>('IChatBotService', {
  useClass: ChatBotService,
});
container.register<IAzureBlobService>('IAzureBlobService', {
  useClass: AzureBlobService,
});