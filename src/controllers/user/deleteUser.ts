/**
 * @copyright 2025 Adeniyi Bella
 * @license Apache-2.0
 */

/**
 * Node modules
 */
import { container } from 'tsyringe';

/**
 * Custom modules
 */
import { logger } from '@/lib/winston';

/**
 * Interfaces
 */
import { IUserService } from '@/services/users/user.interface';
import { IDocumentService } from '@/services/document/document.interface';

/**
 * Types
 */
import type { Request, Response } from 'express';

const deleteUser = async (req: Request, res: Response): Promise<void> => {
  const userService = container.resolve<IUserService>('IUserService');
  const documentService =
    container.resolve<IDocumentService>('IDocumentService');

  try {
    const deleteDocument = await documentService.deleteAllDocuments(req.userId);

    if (!deleteDocument) {
      logger.error('Problem deleting users documents');
      res.status(404).json({
        code: 'ServerError',
        message: 'Internal server error',
      });
      return;
    }

    const deleteUserFromDb = await userService.deleteUser(req.userId);

    if (!deleteUserFromDb) {
      logger.error('User not found in database for deletion');
      res.status(404).json({
        code: 'NotFound',
        message: 'User not found',
      });
      return;
    }

    const deleteUserFromEntraId = await userService.deleteUserFromEntraId(req.userId)
    if (!deleteUserFromEntraId) {
      logger.error('User not found in Entra Id for deletion');
      res.status(404).json({
        code: 'NotFound',
        message: 'User not found',
      });
      return;
    }

    res.status(204).send();
  } catch (err) {
    res.status(500).json({
      code: 'ServerError',
      message: 'Internal server error',
      error: err,
    });

    logger.error('Error during user deletion', err);
  }
};

export default deleteUser;
