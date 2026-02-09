import { container, inject, injectable } from 'tsyringe';
import { Request, Response } from 'express';
import { asyncHandler } from '@/middlewares/errorHandler';
import { IDocumentService } from '@/services/document/document.interface';
import { IChatBotService } from '@/services/chatbot/chatbot.interface';
import { ApiResponse } from '@/lib/api_response';
import { IPlans } from '@/types';
import { IDocumentPreview } from '@/types/DTO';
import fs from 'fs/promises';
import { v4 as uuidv4 } from 'uuid';
import config from '@/config';
import { TranslateQueueService } from '@/services/ai-models/gemini-ai/translate-and-summarize';
import {
  DocumentNotFoundError,
  BadRequestError,
  InvalidInputError,
} from '@/lib/api_response/error';
import { logger } from '@/lib/winston';
import { IChatMessage } from '@/models/chatbotHistory.model';
import { IDocument } from '@/models/document.model';
import path from 'path';
import { validateDocument } from '@/utils/document.utils';

@injectable()
export class DocumentController {
  constructor(
    @inject('IDocumentService') private readonly documentService: IDocumentService,
    @inject('IChatBotService') private readonly chatBotService: IChatBotService,
    @inject('TranslateQueueService') private readonly translateQueueService: TranslateQueueService,
  ) {}

  createDocument = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const { targetLanguage } = req.body;
      const file = req.file as Express.Multer.File;
      
      if (!file) {
        throw new BadRequestError(
          'No file uploaded. Please include a PDF, PNG, or JPEG file.',
        );
      }

      const userPlan = req.user.plan as keyof IPlans;

      if (userPlan !== 'free' && userPlan !== 'standard') {
        logger.warn('Invalid user plan for document processing', {
          userId: req.user.userId,
          plan: req.user.plan,
        });
        throw new BadRequestError('Invalid User Plan.');
      }

      if (req.user.lengthOfDocs[userPlan]?.current! < 1) {
        logger.warn('User has reached document processing limit', {
          userId: req.user.userId,
          remainingDocsForTheMonth: req.user.lengthOfDocs[userPlan]?.current,
        });
        throw new BadRequestError(
          'Document processing limit reached for this month.',
        );
      }

      await validateDocument(file, req.user.plan!, req.user.userId.toString());

      const docId = uuidv4();
      const tempPath = path.join(
        __dirname,
        `../../temp/${docId}-${file.originalname}`,
      );

      let fileWritten = false;

      try {
        await fs.mkdir(path.dirname(tempPath), { recursive: true });
        await fs.writeFile(tempPath, file.buffer);
        fileWritten = true;

        const jobPayload = {
          file: {
            originalname: file.originalname,
            mimetype: file.mimetype,
            filePath: tempPath,
          },
          targetLanguage,
          user: req.user,
          docId,
        };

        await this.translateQueueService.addTranslationJob(
          docId,
          jobPayload,
          req.user.email!,
        );

        ApiResponse.ok(res, 'Document queued for translation', { docId });
      } catch (error) {
        if (fileWritten) {
          await fs.unlink(tempPath).catch((unlinkError) => {
            logger.error('Cleanup Failed: Could not delete file', {
              tempPath,
              unlinkError,
            });
          });
        }
        throw error;
      }
    },
  );

  getAllDocuments = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const limit = parseInt(req.query.limit as string) || config.defaultResLimit;
      const offset = parseInt(req.query.offset as string) || config.defaultResOffset;

      const { total, documents } = await this.documentService.getAllDocumentsByUserId(
        req.user,
        limit,
        offset,
      );

      const plan = req.user.plan as keyof IPlans;
      const documentLimits = req.user.lengthOfDocs[plan];

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
        userPlan: req.user.plan,
        documents: responseDocuments,
        email: req.user.email,
        documentLimits,
      });
    },
  );

  getDocument = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const docId = req.params.docId as string;

      const document = await this.documentService.getDocument(req.user, docId);
      if (!document) {
        throw new DocumentNotFoundError();
      }

      let chats: IChatMessage[] = [];

      const chatHistory = await this.chatBotService.getDocumentChatBotCollection(
        req.userId,
        docId,
      );
      chats = chatHistory?.chats || [];

      ApiResponse.ok(res, 'Document fetched successfully', {
        document,
        chats,
        userPlan: req.user.plan,
      });
    },
  );

  deleteDocument = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const docId = req.params.docId as string;

      const [documentDeleted] = await Promise.all([
        this.documentService.deleteDocument(req.userId, docId),
        this.chatBotService.deleteChatHistoryByDocument(req.userId, docId),
      ]);

      if (!documentDeleted) {
        throw new DocumentNotFoundError();
      }

      ApiResponse.ok(res, 'Document deleted successfully');
    },
  );

  getDocumentChatbotLimit = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const docId = req.params.docId as string;

      const document = await this.documentService.getDocument(req.user, docId);
      if (!document) {
        throw new DocumentNotFoundError();
      }

      const plan = req.user.plan as keyof IPlans;
      const docLimit = document.chatBotPrompt![plan];

      ApiResponse.ok(res, 'Document chatbot limit fetched successfully', {
        docLimit,
      });
    },
  );

  updateActionPlan = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const docId = req.params.docId as string;
      const actionPlanId = req.params.id as string;
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
            throw new BadRequestError('Title is required for creating action plan');
          }
          updatedDocument = await this.documentService.updateActionPlan(
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
          updatedDocument = await this.documentService.updateActionPlan(
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

          const payload = req.body.completed;
          let updateData;

          if (typeof payload === 'boolean') {
            updateData = { completed: payload };
          } else if (typeof payload === 'object') {
            updateData = payload;
          } else {
            throw new BadRequestError('Invalid data for updating action plan');
          }

          if (
            !updateData.title &&
            !updateData.dueDate &&
            updateData.completed === undefined &&
            updateData.emailNotification === undefined &&
            !updateData.location
          ) {
            throw new BadRequestError(
              'At least one field must be provided for update',
            );
          }

          updatedDocument = await this.documentService.updateActionPlan(
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
}

const documentController = container.resolve(DocumentController);

export const createDocument = documentController.createDocument;
export const getAllDocuments = documentController.getAllDocuments;
export const getDocument = documentController.getDocument;
export const deleteDocument = documentController.deleteDocument;
export const getDocumentChatbotLimit = documentController.getDocumentChatbotLimit;
export const updateActionPlan = documentController.updateActionPlan;