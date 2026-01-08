import Document, { IActionPlan, IDocument } from '@/models/document.model';

import { IDocumentService } from './document.interface';

import { injectable } from 'tsyringe';
import { v4 as uuidv4 } from 'uuid';

import { logger } from '@/lib/winston';
import {  UserDTO } from '@/types';


@injectable()
export class DocumentService implements IDocumentService {
  async deleteAllDocuments(userId: string): Promise<boolean> {
    try {
      const result = await Document.deleteMany({ userId }).exec();

      if (result.deletedCount === 0) {
        logger.info('No documents found for deletion', { userId });
      }

      logger.info('All documents deleted successfully', {
        userId,
        deletedCount: result.deletedCount,
      });
      return true;
    } catch (error) {
      logger.error('Failed to delete all documents', { userId, error });
      throw new Error(
        `Failed to delete all documents: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }
  async getAllDocumentsByUserId(
    user: UserDTO,
    limit: number,
    offset: number,
  ): Promise<{
    total: number;
    documents: IDocument[];
  }> {
    if (!user.userId) {
      throw new Error('Valid userId is required');
    }

    const userId = user.userId;

    const total = await Document.countDocuments({ userId });

    const documents = await Document.find({ userId })
      .sort({ createdAt: 1 })
      .select('-__v')
      .limit(limit)
      .skip(offset)
      .lean()
      .exec();

    return { total, documents };
  }

  async createDocumentByUserId(
    document: Partial<IDocument>,
  ): Promise<IDocument> {
    try {
      if (!document || !document.userId || !document.docId) {
        throw new Error('Valid document data is required');
      }
      const createdDocument = await Document.create(document);
      const result = await Document.findById(createdDocument._id)
        .select('-__v')
        .lean()
        .exec();

      if (!result) {
        throw new Error('Failed to retrieve created document');
      }

      return result as IDocument;
    } catch (error) {
      logger.error('Failed to create document', { error: error });
      throw new Error(`Failed to create document: ${error}`);
    }
  }

  async getDocument(
    user: UserDTO,
    docId: string,
  ): Promise<IDocument | null > {
    if (!user.userId || !docId) {
      throw new Error('Valid userId and docId are required');
    }

    const document = await Document.findOne({ userId: user.userId, docId })
      .select('-__v')
      .exec();

    if (!document) {
      return null;
    }

    return document;
  }

  async deleteDocument(userId: string, docId: string): Promise<boolean> {
    try {
      if (!userId || !docId) {
        throw new Error('Valid userId and docId are required');
      }

      const result = await Document.deleteOne({ userId, docId }).exec();

      if (result.deletedCount === 0) {
        logger.info('Document not found for deletion', { userId, docId });
        return false;
      }

      logger.info('Document deleted successfully', { userId, docId });
      return true;
    } catch (error) {
      logger.error('Failed to delete document', { userId, docId, error });
      throw new Error(
        `Failed to delete document: ${error instanceof Error ? error.message : error}`,
      );
    }
  }

  async updateDocument(
    userId: string,
    docId: string,
    updates: Partial<IDocument> | { $inc?: any },
  ): Promise<IDocument | null> {
    try {
      if (!userId || !docId) {
        throw new Error('Valid userId and docId are required');
      }
      if (!updates || Object.keys(updates).length === 0) {
        throw new Error('Valid update data is required');
      }

      const updateQuery =
        '$inc' in updates
          ? { ...updates, $set: { updatedAt: new Date() } }
          : { $set: { ...updates, updatedAt: new Date() } };

      const updatedDocument = await Document.findOneAndUpdate(
        { userId, docId },
        updateQuery,
        { new: true, runValidators: true, select: '-__v' },
      )
        .lean()
        .exec();

      if (!updatedDocument) {
        logger.info('Document not found for update', { userId, docId });
        return null;
      }

      return updatedDocument as IDocument;
    } catch (error) {
      logger.error('Failed to update document', {
        userId,
        docId,
        updates,
        error,
      });
      throw new Error(
        `Failed to update document: ${error instanceof Error ? error.message : error}`,
      );
    }
  }

  async updateActionPlan(
    userId: string,
    docId: string,
    action: 'create' | 'delete' | 'update',
    actionPlanData?: Partial<IActionPlan>,
    actionPlanId?: string,
  ): Promise<IDocument | null> {
    try {
      if (!userId || !docId) {
        throw new Error('Valid userId and docId are required');
      }

      let update: any = {};
      let options: { arrayFilters?: any[] } = {};

      if (action === 'create') {
        if (!actionPlanData || !actionPlanData.title) {
          throw new Error('Title is required for creating an action plan');
        }
        const newActionPlan: IActionPlan = {
          id: uuidv4(),
          title: actionPlanData.title,
          dueDate: actionPlanData.dueDate
            ? new Date(actionPlanData.dueDate)
            : new Date(),
          completed: false,
          location: actionPlanData.location ?? '',
        };
        update = {
          $push: { actionPlans: newActionPlan },
          $set: { updatedAt: new Date() },
        };
      } else if (action === 'delete') {
        if (!actionPlanId) {
          throw new Error('Action plan ID is required for deletion');
        }
        const document = await Document.findOne({
          userId,
          docId,
          'actionPlans.id': actionPlanId,
        }).exec();
        if (!document) {
          logger.info('Document or action plan not found for deletion', {
            userId,
            docId,
            actionPlanId,
          });
          return null;
        }
        update = {
          $pull: { actionPlans: { id: actionPlanId } },
          $set: { updatedAt: new Date() },
        };
      } else if (action === 'update') {
        if (!actionPlanId) {
          throw new Error('Action plan ID is required for update');
        }
        const document = await Document.findOne({
          userId,
          docId,
          'actionPlans.id': actionPlanId,
        }).exec();
        if (!document) {
          logger.info('Document or action plan not found for update', {
            userId,
            docId,
            actionPlanId,
          });
          return null;
        }
        if (
          !actionPlanData ||
          (!actionPlanData.title &&
            !actionPlanData.dueDate &&
            actionPlanData.completed === undefined &&
            !actionPlanData.location)
        ) {
          throw new Error(
            'At least one field (title, dueDate, completed, location) must be provided for update',
          );
        }

        const updateFields: any = {};
        if (actionPlanData.title)
          updateFields['actionPlans.$[elem].title'] = actionPlanData.title;
        if (actionPlanData.dueDate)
          updateFields['actionPlans.$[elem].dueDate'] = new Date(
            actionPlanData.dueDate,
          );
        if (actionPlanData.completed !== undefined)
          updateFields['actionPlans.$[elem].completed'] =
            actionPlanData.completed;
        if (actionPlanData.location)
          updateFields['actionPlans.$[elem].location'] =
            actionPlanData.location;
        updateFields['updatedAt'] = new Date();

        update = { $set: updateFields };
        options = { arrayFilters: [{ 'elem.id': actionPlanId }] };
      } else {
        throw new Error(
          'Invalid action type. Must be "create", "delete", or "update"',
        );
      }

      const updatedDocument = await Document.findOneAndUpdate(
        { userId, docId },
        update,
        { new: true, runValidators: true, select: '-__v', ...options },
      )
        .lean()
        .exec();

      if (!updatedDocument) {
        logger.info('Document not found for action plan update', {
          userId,
          docId,
          action,
        });
        return null;
      }

      logger.info('Action plan updated successfully', {
        userId,
        docId,
        action,
      });
      return updatedDocument as IDocument;
    } catch (error) {
      logger.error('Failed to update action plan', {
        error,
      });
      throw new Error(
        `Failed to update action plan: ${error instanceof Error ? error.message : error}`,
      );
    }
  }
}
