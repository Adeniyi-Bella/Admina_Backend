/**
 * @copyright 2025 Adeniyi Bella
 * @license Apache-2.0
 */

/**
 * Node modules
 */
import { container } from 'tsyringe';

/**
 * Services and Interfaces
 */
import { IUserService } from '@/services/users/user.interface';
import { UserService } from '@/services/users/user.service';
import { IDocumentService } from '@/services/document/document.interface';
import { DocumentService } from '@/services/document/document.service';

// Register the interface with its implementation
container.register<IUserService>('IUserService', {
  useClass: UserService,
});
container.register<IDocumentService>('IDocumentService', {
  useClass: DocumentService,
});
