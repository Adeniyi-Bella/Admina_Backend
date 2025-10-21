import { ApiResponse } from '@/lib/api_response';
import { logger } from '@/lib/winston';
import { IDocument } from '@/models/document.model';
import { IDocumentService } from '@/services/document/document.interface';
import type { Request, Response } from 'express';
import { container } from 'tsyringe';

const updateActionPlan = async (req: Request, res: Response): Promise<void> => {
  const documentService =
    container.resolve<IDocumentService>('IDocumentService');

  try {
    const userId = req.userId;
    const docId = req.params.docId;
    const actionPlanId = req.params.id;
    const requestType = req.query.type as string;

    if (!userId || !docId) {
      throw new Error('user id and doc id are required');
    }

    if (!requestType || !['create', 'delete', 'update'].includes(requestType)) {
      ApiResponse.badRequest(
        res,
        'Invalid request type. Must be "create", "delete", or "update"',
      );
      return;
    }

    let updatedDocument: IDocument | null = null;

    if (requestType === 'delete') {
      if (!actionPlanId) {
        ApiResponse.badRequest(res, 'Action plan ID is required for delete.');
        return;
      }
      updatedDocument = await documentService.updateActionPlan(
        userId,
        docId,
        'delete',
        undefined,
        actionPlanId,
      );
    } else {
      if (!req.body) {
        ApiResponse.badRequest(res, 'Request body is missing.');
        return;
      }

      if (requestType === 'create') {
        const { title, dueDate, completed, location } = req.body.completed;
        if (!title) {
          ApiResponse.badRequest(
            res,
            'Request body is missing the right data.',
          );
          return;
        }

        updatedDocument = await documentService.updateActionPlan(
          userId,
          docId,
          'create',
          {
            title,
            dueDate,
            completed,
            location,
          },
        );
      } else if (requestType === 'update') {
        if (!actionPlanId) {
          ApiResponse.badRequest(res, 'Action plan ID is required for update.');
          return;
        }

        let title, dueDate, completed, location;

        if (typeof req.body.completed === 'boolean') {
          completed = req.body.completed;
          ({ title, dueDate, location } = req.body);
        } else if (
          typeof req.body.completed === 'object'
        ) {
          ({ title, dueDate, completed, location } = req.body.completed);
        } else {
          ApiResponse.badRequest(res, 'Invalid body format.');
          return;
        }
        if (!title && !dueDate && completed === undefined && !location) {
          ApiResponse.badRequest(
            res,
            'At least one field (title, dueDate, completed, location) must be provided for update.',
          );
          return;
        }

        updatedDocument = await documentService.updateActionPlan(
          userId,
          docId,
          'update',
          { completed, location, title, dueDate },
          actionPlanId,
        );

        if (!updatedDocument) {
          ApiResponse.notFound(
            res,
            'Document or action plan not found for update.',
          );
          return;
        }
      }
    }

    ApiResponse.ok(res, 'Document fetched successfully', {
      document: updatedDocument,
    });
  } catch (error: unknown) {
    logger.error('Error deleting document', error);
    // Check if error is an instance of Error to safely access message
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    ApiResponse.serverError(res, 'Internal server error', errorMessage);
  }
};

export default updateActionPlan;
