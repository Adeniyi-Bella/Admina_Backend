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
import { IUserService } from '@/services/users/user.interface';
import { IDocumentService } from '@/services/document/document.interface';
import { IChatBotService } from '@/services/chatbot/chatbot.interface';
import { ChatBotService } from '@/services/chatbot/chatbot.service';
import { IGeminiAIService } from '@/services/ai-models/gemini-ai/geminiai.interface';
import { GeminiAIService } from '@/services/ai-models/gemini-ai/geminiai.service';
import { NotificationService } from '@/services/notifications/notification.service';
import { TranslateQueueService } from '@/services/ai-models/gemini-ai/translate-and-summarize';

container.register<TranslateQueueService>('TranslateQueueService', {
  useClass: TranslateQueueService,
});
// Register the interface with its implementation
container.register<NotificationService>('NotificationService', {
  useClass: NotificationService,
});
container.register<IUserService>('IUserService', {
  useClass: UserService,
});
container.register<IDocumentService>('IDocumentService', {
  useClass: DocumentService,
});
container.register<IGeminiAIService>('IGeminiAIService', {
  useClass: GeminiAIService,
});
container.register<IChatBotService>('IChatBotService', {
  useClass: ChatBotService,
});
