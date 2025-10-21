import config from '@/config';
import { logger } from '@/lib/winston';

import { container } from 'tsyringe';

import { IDocumentService } from '@/services/document/document.interface';

import type { Request, Response } from 'express';
import { ApiResponse } from '@/lib/api_response';
import { IUserService } from '@/services/users/user.interface';

const getAllDocuments = async (req: Request, res: Response): Promise<void> => {
  const documentService =
    container.resolve<IDocumentService>('IDocumentService');
  const userService = container.resolve<IUserService>('IUserService');
  try {
    const user = await userService.checkIfUserExist(req);
    if (!user) {
      ApiResponse.notFound(res, 'User not found');
      return;
    }
    const limit = parseInt(req.query.limit as string) || config.defaultResLimit;
    const offset =
      parseInt(req.query.offset as string) || config.defaultResOffset;

    const { total, documents } = await documentService.getAllDocumentsByUserId(
      user,
      limit,
      offset,
    );

    res.status(200).json({
      limit,
      offset,
      total,
      documents,
      userPlan: user.plan,
    });
  } catch (error: unknown) {
    logger.error('Error getting all documents', error);
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    ApiResponse.serverError(res, 'Internal server error', errorMessage);
  }
};

export default getAllDocuments;
