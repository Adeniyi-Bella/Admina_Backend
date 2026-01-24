import Document, { IActionPlan, IDocument } from '@/models/document.model';

import { IDocumentService } from './document.interface';

import { injectable } from 'tsyringe';
import { v4 as uuidv4 } from 'uuid';

import { logger } from '@/lib/winston';
import { UserDTO } from '@/types';
import { DatabaseError, InvalidInputError } from '@/lib/api_response/error';
import { cacheService } from '../redis-cache/redis-cache.service';

@injectable()
export class DocumentService implements IDocumentService {
  private getDocumentCacheKey(userId: string, docId: string): string {
    return `doc:${userId}:${docId}`;
  }

  private getDocumentListCacheKey(userId: string): string {
    return `docs:list:${userId}`;
  }

  private getDocumentTag(userId: string): string {
    return `tag:docs:${userId}`;
  }
  async deleteAllDocuments(userId: string): Promise<void> {
    if (!userId) {
      throw new InvalidInputError('Valid userId is required');
    }
    try {
      const result = await Document.deleteMany({ userId }).exec();

      await cacheService.invalidateTag(this.getDocumentTag(userId));
      await cacheService.delete(this.getDocumentListCacheKey(userId));

      logger.info('Document history cleanup completed', {
        userId,
        deletedCount: result.deletedCount,
      });

    } catch (error) {
      logger.error('Failed to delete all documents', { userId, error });
      throw new DatabaseError('Failed to delete all documents');
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
      throw new InvalidInputError('Valid userId is required');
    }

    try {
      const userId = user.userId;

      const cacheKey = `${this.getDocumentListCacheKey(userId)}:${limit}:${offset}`;

      const result = await cacheService.getOrFetch<{
        total: number;
        documents: IDocument[];
      }>(
        cacheKey,
        async () => {
          logger.info('Cache miss: fetching documents from DB', {
            userId,
            limit,
            offset,
          });

          const [total, documents] = await Promise.all([
            Document.countDocuments({ userId }),
            Document.find({ userId })
              .sort({ createdAt: 1 })
              .select('-__v')
              .limit(limit)
              .skip(offset)
              .lean()
              .exec(),
          ]);

          // Add this key to the user's document tag for invalidation
          await cacheService.addToTag(this.getDocumentTag(userId), cacheKey);

          return { total, documents };
        },
        1800, // 30 minutes for lists
      );

      return result!;
    } catch (error) {
      logger.error('Failed to fetch documents', { userId: user.userId, error });
      throw new DatabaseError('Failed to retrieve documents');
    }
  }

  async createDocumentByUserId(
    document: Partial<IDocument>,
  ): Promise<IDocument> {
    if (!document?.userId || !document?.docId) {
      throw new InvalidInputError(
        'Valid document data with userId and docId required',
      );
    }
    try {
      const createdDocument = await Document.create(document);
      const result = await Document.findById(createdDocument._id)
        .select('-__v')
        .lean()
        .exec();

      if (!result) {
        throw new DatabaseError('Failed to retrieve created document');
      }

      await cacheService.invalidateTag(this.getDocumentTag(document.userId));

      return result as IDocument;
    } catch (error) {
      logger.error('Failed to create document', { error });
      if (error instanceof Error) {
        throw error;
      }
      throw new DatabaseError('Failed to create document');
    }
  }

  async getDocument(user: UserDTO, docId: string): Promise<IDocument | null> {
    if (!user.userId || !docId) {
      throw new InvalidInputError('Valid userId and docId are required');
    }

    try {
      const cacheKey = this.getDocumentCacheKey(user.userId, docId);

      // SENIOR PATTERN: Use getOrFetch with Request Coalescing
      return cacheService.getOrFetch(
        cacheKey,
        async () => {
          logger.info('Cache miss: fetching document from DB', {
            userId: user.userId,
            docId,
          });

          const document = await Document.findOne({
            userId: user.userId,
            docId,
          })
            .select('-__v')
            .exec();

          if (document) {
            // Add to tag for grouped invalidation
            await cacheService.addToTag(
              this.getDocumentTag(user.userId),
              cacheKey,
            );
          }

          return document;
        },
        3600, // 1 hour
      );
    } catch (error) {
      logger.error('Failed to fetch document', {
        userId: user.userId,
        docId,
        error,
      });
      throw new DatabaseError('Failed to retrieve document');
    }
  }

  async deleteDocument(userId: string, docId: string): Promise<boolean> {
    if (!userId || !docId) {
      throw new InvalidInputError('Valid userId and docId are required');
    }
    try {
      const result = await Document.deleteOne({ userId, docId }).exec();
      if (result.deletedCount > 0) {
        await cacheService.delete(this.getDocumentCacheKey(userId, docId));
        await cacheService.invalidateTag(this.getDocumentTag(userId));
      }

      return result.deletedCount > 0;
    } catch (error) {
      logger.error('Failed to delete document', { userId, docId, error });
      throw new DatabaseError('Failed to delete document');
    }
  }

  async updateDocument(
    userId: string,
    docId: string,
    updates: Partial<IDocument> | { $inc?: any },
  ): Promise<IDocument | null> {
    if (!userId || !docId) {
      throw new InvalidInputError('Valid userId and docId are required');
    }

    if (!updates || Object.keys(updates).length === 0) {
      throw new InvalidInputError('Valid update data is required');
    }
    try {
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

      if (updatedDocument) {
        await cacheService.delete(this.getDocumentCacheKey(userId, docId));
        await cacheService.invalidateTag(this.getDocumentTag(userId));
      }

      return updatedDocument as IDocument;
    } catch (error) {
      logger.error('Failed to update document', { userId, docId, error });
      throw new DatabaseError('Failed to update document');
    }
  }

  async updateActionPlan(
    userId: string,
    docId: string,
    action: 'create' | 'delete' | 'update',
    actionPlanData?: Partial<IActionPlan>,
    actionPlanId?: string,
  ): Promise<IDocument | null> {
    if (!userId || !docId) {
      throw new InvalidInputError('Valid userId and docId are required');
    }

    try {
      const update = this.buildActionPlanUpdate(
        action,
        actionPlanData,
        actionPlanId,
      );
      const options =
        action === 'update' && actionPlanId
          ? { arrayFilters: [{ 'elem.id': actionPlanId }] }
          : {};

      const updatedDocument = await Document.findOneAndUpdate(
        { userId, docId },
        update,
        { new: true, runValidators: true, select: '-__v', ...options },
      )
        .lean()
        .exec();

      if (updatedDocument) {
        await cacheService.delete(this.getDocumentCacheKey(userId, docId));
        await cacheService.invalidateTag(this.getDocumentTag(userId));
      }

      return updatedDocument as IDocument;
    } catch (error) {
      logger.error('Failed to update action plan', {
        userId,
        docId,
        action,
        error,
      });
      throw new DatabaseError('Failed to update action plan');
    }
  }

  private buildActionPlanUpdate(
    action: 'create' | 'delete' | 'update',
    actionPlanData?: Partial<IActionPlan>,
    actionPlanId?: string,
  ): any {
    switch (action) {
      case 'create':
        if (!actionPlanData?.title) {
          throw new InvalidInputError(
            'Title is required for creating an action plan',
          );
        }
        return {
          $push: {
            actionPlans: {
              id: uuidv4(),
              title: actionPlanData.title,
              dueDate: actionPlanData.dueDate
                ? new Date(actionPlanData.dueDate)
                : new Date(),
              completed: false,
              location: actionPlanData.location ?? '',
            },
          },
          $set: { updatedAt: new Date() },
        };

      case 'delete':
        if (!actionPlanId) {
          throw new InvalidInputError(
            'Action plan ID is required for deletion',
          );
        }
        return {
          $pull: { actionPlans: { id: actionPlanId } },
          $set: { updatedAt: new Date() },
        };

      case 'update':
        if (!actionPlanId) {
          throw new InvalidInputError('Action plan ID is required for update');
        }
        if (!actionPlanData || Object.keys(actionPlanData).length === 0) {
          throw new InvalidInputError(
            'At least one field must be provided for update',
          );
        }

        const updateFields: any = { updatedAt: new Date() };
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

        return { $set: updateFields };

      default:
        throw new InvalidInputError(
          'Invalid action type. Must be "create", "delete", or "update"',
        );
    }
  }
}
