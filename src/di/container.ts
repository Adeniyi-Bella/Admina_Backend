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
import { AzureFreeSubscriptionService } from '@/services/azure/free-users/azure.free.service';
import { ChatGTPService } from '@/services/chat-gtp/chat-gtp.service';
import { IUserService } from '@/services/users/user.interface';
import { IDocumentService } from '@/services/document/document.interface';
import { IAzureFreeSubscriptionService } from '@/services/azure/free-users/azure.free.interface';
import { IChatGTPService } from '@/services/chat-gtp/chat-gtp.interface';
import { IAzurePremiumSubscriptionService } from '@/services/azure/premium-users/azure.premium.interface';
import { AzurePremiumSubscriptionService } from '@/services/azure/premium-users/azure.premium.service';


// Register the interface with its implementation
container.register<IUserService>('IUserService', {
  useClass: UserService,
});
container.register<IDocumentService>('IDocumentService', {
  useClass: DocumentService,
});
container.register<IAzureFreeSubscriptionService>('IAzureFreeSubscriptionService', {
  useClass: AzureFreeSubscriptionService,
});
container.register<IAzurePremiumSubscriptionService>('IAzurePremiumSubscriptionService', {
  useClass: AzurePremiumSubscriptionService,
});
container.register<IChatGTPService>('IChatGTPService', {
  useClass: ChatGTPService,
});
