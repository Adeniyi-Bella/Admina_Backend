import { container } from 'tsyringe';
import { Request, Response } from 'express';
import { asyncHandler } from '@/middlewares/errorHandler';
import { IDocumentService } from '@/services/document/document.interface';
import { IUserService } from '@/services/users/user.interface';
import { IChatBotService } from '@/services/chatbot/chatbot.interface';
import { ApiResponse } from '@/lib/api_response';
import { IPlans } from '@/types';
import { IDocumentPreview } from '@/types/DTO';
import fs from 'fs/promises';
import { v4 as uuidv4 } from 'uuid';
import config from '@/config';
import { TranslateQueueService } from '@/services/ai-models/jobs/job-queues.service';
import {
  UserNotFoundError,
  DocumentNotFoundError,
  BadRequestError,
  TooManyRequestsError,
  InvalidInputError,
} from '@/lib/api_response/error';
import { logger } from '@/lib/winston';
import { IChatMessage } from '@/models/chatbotHistory.model';
import { IDocument } from '@/models/document.model';
import path from 'path';
import { validateDocument } from '@/utils/document.utils';

const translateQueueService = new TranslateQueueService();

/**
 * CREATE DOCUMENT CONTROLLER
 */
export const createDocument = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const userService = container.resolve<IUserService>('IUserService');

    const { targetLanguage } = req.body;
    const file = req.file as Express.Multer.File;
    if (!file)
      throw new BadRequestError(
        'No file uploaded. Please include a PDF, PNG, or JPEG file.',
      );

    const user = await userService.checkIfUserExist(req);
    if (!user) throw new UserNotFoundError();

    const userPlan = user.plan as keyof IPlans;

    if (userPlan !== 'free' && userPlan !== 'standard') {
      logger.warn('Invalid user plan for document processing', {
        userId: user.userId,
        plan: user.plan,
      });
      throw new BadRequestError('Invalid User Plan.');
    }

    if (user.lengthOfDocs[userPlan]?.current! < 1) {
      logger.warn('User has reached document processing limit', {
        userId: user.userId,
        remainingDocsForTheMonth: user.lengthOfDocs[userPlan]?.current,
      });
      throw new BadRequestError(
        'Document processing limit reached for this month.',
      );
    }

    await validateDocument(file, user.plan!, user.userId.toString());

    // Check if user already has a document being processed
    const isProcessing = await translateQueueService.isUserProcessing(
      user.email!,
    );
    if (isProcessing) {
      throw new TooManyRequestsError(
        'You already have a document being processed',
      );
    }

    const docId = uuidv4();

    // SAVE TO DISK INSTEAD OF BASE64 CONVERSION
    // This is non-blocking (handled by libuv)
    const tempPath = path.join(
      __dirname,
      `../../temp/${docId}-${file.originalname}`,
    );
    await fs.mkdir(path.dirname(tempPath), { recursive: true });
    await fs.writeFile(tempPath, file.buffer);

    const jobPayload = {
      file: {
        originalname: file.originalname,
        mimetype: file.mimetype,
        filePath: tempPath,
      },
      targetLanguage,
      user,
      docId,
    };

    await translateQueueService.addTranslationJob(
      docId,
      jobPayload,
      user.email!,
    );

    ApiResponse.ok(res, 'Document queued for translation', { docId });
  },
);

/**
 * GET ALL DOCUMENTS CONTROLLER
 */
export const getAllDocuments = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const documentService =
      container.resolve<IDocumentService>('IDocumentService');
    const userService = container.resolve<IUserService>('IUserService');

    const user = await userService.checkIfUserExist(req);
    if (!user) {
      throw new UserNotFoundError();
    }

    const limit = parseInt(req.query.limit as string) || config.defaultResLimit;
    const offset =
      parseInt(req.query.offset as string) || config.defaultResOffset;

    const { total, documents } = await documentService.getAllDocumentsByUserId(
      user,
      limit,
      offset,
    );

    const plan = user.plan as keyof IPlans;
    const documentLimits = user.lengthOfDocs[plan];

    const responseDocuments: IDocumentPreview[] = documents.map((doc) => ({
      docId: doc.docId!,
      title: doc.title!,
      sender: doc.sender!,
      receivedDate: doc.receivedDate,
      actionPlans: doc.actionPlans?.map((ap) => ({
        title: ap.title,
        dueDate: ap.dueDate,
        completed: ap.completed,
        location: ap.location,
      })),
    }));

    ApiResponse.ok(res, 'Documents fetched successfully', {
      limit,
      offset,
      total,
      userPlan: user.plan,
      documents: responseDocuments,
      email: user.email,
      documentLimits,
    });
  },
);

/**
 * GET SINGLE DOCUMENT CONTROLLER
 */
export const getDocument = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const documentService =
      container.resolve<IDocumentService>('IDocumentService');
    const chatBotService =
      container.resolve<IChatBotService>('IChatBotService');
    const userService = container.resolve<IUserService>('IUserService');

    const { docId } = req.params;

    const user = await userService.checkIfUserExist(req);
    if (!user) {
      throw new UserNotFoundError();
    }

    const document = await documentService.getDocument(user, docId);
    if (!document) {
      throw new DocumentNotFoundError();
    }

    let chats: IChatMessage[] = [];

    const chatHistory = await chatBotService.getDocumentChatBotCollection(
      req.userId,
      docId,
    );
    chats = chatHistory?.chats || [];

    ApiResponse.ok(res, 'Document fetched successfully', {
      document,
      chats,
      userPlan: user.plan,
    });
  },
);

/**
 * DELETE DOCUMENT CONTROLLER
 */
export const deleteDocument = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const documentService =
      container.resolve<IDocumentService>('IDocumentService');
    const chatBotService =
      container.resolve<IChatBotService>('IChatBotService');

    const { docId } = req.params;

    const [documentDeleted, _] = await Promise.all([
      documentService.deleteDocument(req.userId, docId),
      chatBotService.deleteChatHistoryByDocument(req.userId, docId),
    ]);

    if (!documentDeleted) {
      throw new DocumentNotFoundError();
    }

    ApiResponse.ok(res, 'Document deleted successfully');
  },
);

/**
 * GET DOCUMENT CHATBOT LIMIT CONTROLLER
 */
export const getDocumentChatbotLimit = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const documentService =
      container.resolve<IDocumentService>('IDocumentService');
    const userService = container.resolve<IUserService>('IUserService');

    const { docId } = req.params;

    const user = await userService.checkIfUserExist(req);
    if (!user) {
      throw new UserNotFoundError();
    }

    const document = await documentService.getDocument(user, docId);
    if (!document) {
      throw new DocumentNotFoundError();
    }

    const plan = user.plan as keyof IPlans;
    const docLimit = document.chatBotPrompt![plan];

    ApiResponse.ok(res, 'Document chatbot limit fetched successfully', {
      docLimit,
    });
  },
);

/**
 * UPDATE ACTION PLAN CONTROLLER
 */
export const updateActionPlan = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const documentService =
      container.resolve<IDocumentService>('IDocumentService');

    const { docId, id: actionPlanId } = req.params;
    const requestType = req.query.type as 'create' | 'delete' | 'update';

    if (!req.userId || !docId) {
      throw new InvalidInputError('Valid userId and docId are required');
    }

    if (!requestType || !['create', 'delete', 'update'].includes(requestType)) {
      throw new BadRequestError(
        "Invalid request type. Must be 'create', 'delete', or 'update'",
      );
    }

    let updatedDocument: IDocument | null = null;

    switch (requestType) {
      case 'create':
        const { title, dueDate, completed, location } = req.body.completed;
        if (!title) {
          throw new BadRequestError(
            'Title is required for creating action plan',
          );
        }
        updatedDocument = await documentService.updateActionPlan(
          req.userId,
          docId,
          'create',
          { title, dueDate, completed, location },
        );
        break;

      case 'delete':
        if (!actionPlanId) {
          throw new BadRequestError('Action plan ID is required for deletion');
        }
        updatedDocument = await documentService.updateActionPlan(
          req.userId,
          docId,
          'delete',
          undefined,
          actionPlanId,
        );
        break;

      case 'update':
        if (!actionPlanId) {
          throw new BadRequestError('Action plan ID is required for update');
        }

        let updateData;
        if (typeof req.body.completed === 'boolean') {
          updateData = { ...req.body, completed: req.body.completed };
        } else if (typeof req.body.completed === 'object') {
          updateData = req.body.completed;
        } else {
          throw new BadRequestError('Invalid data for updating action plan');
        }

        if (
          !updateData.title &&
          !updateData.dueDate &&
          updateData.completed === undefined &&
          !updateData.location
        ) {
          throw new BadRequestError(
            'At least one field must be provided for update',
          );
        }

        updatedDocument = await documentService.updateActionPlan(
          req.userId,
          docId,
          'update',
          updateData,
          actionPlanId,
        );
        break;
    }

    if (!updatedDocument) {
      throw new DocumentNotFoundError();
    }

    ApiResponse.ok(res, 'Action plan updated successfully', {
      document: updatedDocument,
    });
  },
);
