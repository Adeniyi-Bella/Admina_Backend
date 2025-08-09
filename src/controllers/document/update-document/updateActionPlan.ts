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
    const id = req.params.id;
    const requestType = req.query.type as string;

    if (!userId || !docId) {
      res.status(400).json({
        code: 'Bad Request',
        message: 'User ID and document ID are required',
      });
      return;
    }

    if (!requestType || !['create', 'delete', 'update'].includes(requestType)) {
      res.status(400).json({
        code: 'Bad Request',
        message:
          'Invalid request type. Must be "create", "delete", or "update"',
      });
      return;
    }

    let updatedDocument: IDocument | null = null;

    if (requestType === 'create') {
      if (!req.body) {
        res.status(400).json({
          code: 'Bad Request',
          message: 'Request body is required for creating an action plan',
        });
        return;
      }
      const { title, dueDate, completed, location } = req.body;
      if (!title) {
        res.status(400).json({
          code: 'Bad Request',
          message: 'Title is required for creating an action plan',
        });
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
    } else if (requestType === 'delete') {
      if (!id) {
        res.status(400).json({
          code: 'Bad Request',
          message: 'Action plan ID is required for deletion',
        });
        return;
      }

      updatedDocument = await documentService.updateActionPlan(
        userId,
        docId,
        'delete',
        undefined,
        id,
      );
    } else if (requestType === 'update') {
      if (!id) {
        res.status(400).json({
          code: 'Bad Request',
          message: 'Action plan ID is required for update',
        });
        return;
      }
      if (!req.body) {
        res.status(400).json({
          code: 'Bad Request',
          message: 'Request body is required for updating an action plan',
        });
        return;
      }

      const { title, dueDate, completed, location } = req.body;
      if (!title && !dueDate && completed === undefined && !location) {
        res.status(400).json({
          code: 'Bad Request',
          message:
            'At least one field (title, dueDate, completed, location) must be provided for update',
        });
        return;
      }

      updatedDocument = await documentService.updateActionPlan(
        userId,
        docId,
        'update',
        { completed, location, title, dueDate },
        id,
      );
    }

    if (!updatedDocument) {
      res.status(404).json({
        code: 'NotFound',
        message: 'Invalid Data provided. Please try with the right data',
      });
      return;
    }

    res.status(200).json({ document: updatedDocument });
  } catch (err) {
    const errorDetails =
      err instanceof Error ? { message: err.message, stack: err.stack } : err;
    res.status(500).json({
      code: 'ServerError',
      message: 'Internal server error',
      error: errorDetails,
    });
    logger.error('Error while updating action plan', {
      userId: req.userId,
      docId: req.params.docId,
      requestType: req.query.type,
      error: errorDetails,
    });
  }
};

export default updateActionPlan;
