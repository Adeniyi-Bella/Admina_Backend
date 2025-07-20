/**
 * @copyright 2025 Adeniyi Bella
 * @license Apache-2.0
 */

/**
 * Node modules
 */
import { container } from 'tsyringe';

/**
 * Services
 */
import { UserService } from '@/services/users/user.service';
import { DocumentService } from '@/services/document/document.service';
import { AzureService } from '@/services/azure/azure.service';

/**
 * Interfaces
 */
import { IUserService } from '@/services/users/user.interface';
import { IDocumentService } from '@/services/document/document.interface';
import { IAzureService } from '@/services/azure/azure.interface';


// Register the interface with its implementation
container.register<IUserService>('IUserService', {
  useClass: UserService,
});
container.register<IDocumentService>('IDocumentService', {
  useClass: DocumentService,
});
container.register<IAzureService>('IAzureService', {
  useClass: AzureService,
});
