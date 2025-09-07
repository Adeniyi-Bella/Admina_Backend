/**
 * @copyright 2025 Adeniyi Bella
 * @license Apache-2.0
 */

/**
 * Models
 */
import User from '@/models/user.model';

/**
 * Interfaces
 */
import { IUserService, UserDTO } from './user.interface';
import { IDocumentService } from '../document/document.interface';
import { IGeminiAIService } from '../ai-models/gemini-ai/geminiai.interface';

/**
 * Node modules
 */
import { injectable } from 'tsyringe';
import { v4 as uuidv4 } from 'uuid';
import pdf from 'pdf-parse';

/**
 * Custom modules
 */
import { logger } from '@/lib/winston';

/**
 * Types
 */
import type { Request, Response } from 'express';
import config from '@/config';
import { ConfidentialClientApplication } from '@azure/msal-node';
import { Client } from '@microsoft/microsoft-graph-client';
import { IDocument } from '@/models/document.model';
import { handleSseAsyncOperation, sendSseMessage } from '../azure/utils';
import e from 'express';

@injectable()
export class UserService implements IUserService {
  private config = {
    auth: {
      clientId: config.AZURE_CLIENT_ID!,
      clientSecret: config.AZURE_CLIENT_SECRETE!,
      authority: config.AZURE_CLIENT_AUTHORITY,
    },
  };

  /**
   * Count PDF pages using pdf-parse
   */
  private async countPdfPages(buffer: Buffer): Promise<number> {
    const data = await pdf(buffer);
    return data.numpages || 0;
  }

  async analyzeDocumentContentForFreemiumUser(
    file: Express.Multer.File,
    targetLanguage: string,
    user: UserDTO,
    res: Response,
    geminiAIService: IGeminiAIService,
    documentService: IDocumentService,
  ): Promise<void> {
    const pageCount = await this.countPdfPages(file.buffer);
    if (user.plan === 'free' && pageCount > 2) {
      logger.error('Page count exceeds limit for free users', {
        userId: user.userId,
        pageCount,
      });
      sendSseMessage(res, 'error', {
        message: 'Free users can only upload up to 2 pages',
      });
      sendSseMessage(res, 'complete', { status: 'failed' });
      return;
    } else if (user.plan === 'standard' && pageCount > 4) {
      logger.error('Page count exceeds limit for standard users', {
        userId: user.userId,
        pageCount,
      });
      sendSseMessage(res, 'error', {
        message: 'Standard users can only upload up to 4 pages',
      });
      sendSseMessage(res, 'complete', { status: 'failed' });
      return;
    }

    // Send initial event
    sendSseMessage(res, 'message', 'Started Document Analysis for User');

    const analyzedDocument = await handleSseAsyncOperation(
      res,
      () => geminiAIService.analyzePDFDocument(file, targetLanguage),
      'Failed to analyze document',
    );

    // Send translated text event
    sendSseMessage(res, 'status', {
      message: 'Document Analyzed Successfully with gemini',
    });

    // Create document in MongoDB
    const documentData: IDocument = {
      userId: user.userId.toString(),
      docId: uuidv4(),
      title: analyzedDocument.title || '',
      sender: analyzedDocument.sender || '',
      receivedDate: analyzedDocument.receivedDate || new Date(),
      summary: analyzedDocument.summary || '',
      translatedText: analyzedDocument.translatedText || '',
      structuredTranslatedText: analyzedDocument.structuredTranslatedText,
      targetLanguage,
      actionPlan: analyzedDocument.actionPlan || [],
      actionPlans: (analyzedDocument.actionPlans || []).map((plan: any) => ({
        id: plan.id || uuidv4(),
        title: plan.title || '',
        dueDate: plan.dueDate || new Date(),
        completed: plan.completed ?? false,
        location: plan.location || '',
      })),
      pdfBlobStorage: false,
    };

    await handleSseAsyncOperation(
      res,
      () => documentService.createDocumentByUserId(documentData),
      'Failed to create document in MongoDB',
    );

    sendSseMessage(res, 'status', {
      message: 'Document Created Successfully in MongoDB',
    });

    // Update lengthOfDocs
    if (user.plan === 'free') {
      await handleSseAsyncOperation(
        res,
        () =>
          this.updateUser(
            user.userId,
            'lengthOfDocs.free.current',
            true,
            undefined,
          ),
        'Failed to update lengthOfDocs for user',
      );
    } else if (user.plan === 'standard') {
      await handleSseAsyncOperation(
        res,
        () =>
          this.updateUser(
            user.userId,
            'lengthOfDocs.standard.current',
            true,
            undefined,
          ),
        'Failed to update lengthOfDocs for user',
      );
    } else {
      logger.error('Invalid user plan for document processing', {
        userId: user.userId,
        plan: user.plan,
      });
      sendSseMessage(res, 'error', { message: 'Invalid user plan' });
      sendSseMessage(res, 'complete', { status: 'failed' });
      return;
    }

    // Signal completion
    sendSseMessage(res, 'complete', { status: 'completed' });
  }

  async deleteUserFromEntraId(userId: string): Promise<boolean> {
    try {
      if (!userId) {
        throw new Error('Valid userId is required');
      }

      const cca = new ConfidentialClientApplication(this.config);

      const result = await cca.acquireTokenByClientCredential({
        scopes: ['https://graph.microsoft.com/.default'],
      });

      if (!result?.accessToken) {
        logger.error('Failed to acquire Graph token for Entra ID deletion', {
          userId,
        });
        throw new Error('Failed to acquire Graph token');
      }

      const client = Client.init({
        authProvider: (done) => done(null, result.accessToken),
      });

      await client.api(`/users/${userId}`).delete();
      logger.info('User deleted successfully from Entra ID', { userId });
      return true;
    } catch (error: any) {
      if (error.statusCode === 404) {
        logger.warn('User not found in Entra ID for deletion', { userId });
        return false;
      }
      logger.error('Failed to delete user from Entra ID', { userId, error });
      throw new Error(`Failed to delete user from Entra ID`);
    }
  }

  async deleteUser(userId: string): Promise<boolean> {
    try {
      const result = await User.deleteOne({ userId }).exec();

      if (result.deletedCount === 0) {
        logger.warn('User not found for deletion', { userId });
        return false;
      }

      logger.info('User deleted successfully', { userId });
      return true;
    } catch (error) {
      logger.error('Error deleting user', { userId, error });
      throw new Error(
        `Failed to delete user: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  async updateUser(
    userId: string,
    property: string,
    decrement: boolean,
    value: string | undefined | number | {},
  ): Promise<boolean> {
    try {
      const update = decrement
        ? { $inc: { [property]: -1 }, $set: { updatedAt: new Date() } }
        : { $set: { [property]: value, updatedAt: new Date() } };

      const result = await User.updateOne({ userId }, update).exec();

      if (result.modifiedCount === 0) {
        logger.warn(`User not found or ${property} not updated`, { userId });
        return false;
      }

      logger.info(
        `${property} ${decrement ? 'decremented' : 'updated'} successfully`,
        { userId, property, value: decrement ? 1 : value },
      );
      return true;
    } catch (error) {
      logger.error(`Error updating ${property}`, { userId, property, error });
      throw new Error(
        `Failed to update ${property}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  async checkIfUserExist(req: Request): Promise<UserDTO | null> {
    const userId = req.userId;
    logger.info('user id:', { userId: userId });
    const user = await User.findOne({ userId }).select('-__v').exec();
    logger.info('user from db', { user: user });
    if (!user) return null;
    return {
      userId: String(user.userId),
      plan: user.plan,
      lengthOfDocs: user.lengthOfDocs,
    };
  }

  async createUserFromToken(req: Request): Promise<void> {
    const userId = req.userId;
    const email = req.email;
    const username = req.username;

    await User.create({
      userId,
      email: email,
      username: username,
    });

    // return {
    //   userId: String(newUser.userId),
    //   plan: newUser.plan,
    // };
  }
}
