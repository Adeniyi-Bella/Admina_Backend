/**
 * @copyright 2025 Adeniyi Bella
 * @license Apache-2.0
 */

/**
 * Node modules
 */
import type { Response } from 'express';
import { OcrDetectionLanguage } from '@azure/cognitiveservices-computervision/esm/models';
import { IChatGTPService } from '@/services/chat-gtp/chat-gtp.interface';
import { IDocumentService } from '@/services/document/document.interface';
import { IUserService } from '@/services/users/user.interface';

export interface IAzurePremiumSubscriptionService {
  uploadPdfToBlob(file: Express.Multer.File, blobName: string): Promise<void>;

  translateDocument(blobName: string, targetLanguage: string): Promise<boolean>;

  downloadPdfFromBlob(blobName: string): Promise<Express.Multer.File>;

  processPremiumUserDocument(params: {
    file: Express.Multer.File;
    docLanguage: OcrDetectionLanguage;
    targetLanguage: string;
    userId: string;
    res: Response;
    chatgtpService: IChatGTPService;
    documentService: IDocumentService;
    userService: IUserService;
  }): Promise<void>;
}
