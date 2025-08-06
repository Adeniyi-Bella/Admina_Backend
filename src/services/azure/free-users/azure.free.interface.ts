/**
 * @copyright 2025 Adeniyi Bella
 * @license Apache-2.0
 */

/**
 * Types
 */
import { IChatGTPService } from '@/services/chat-gtp/chat-gtp.interface';
import { IDocumentService } from '@/services/document/document.interface';
import { IUserService } from '@/services/users/user.interface';
import { ExtractTextReqDTO, ExtractTextResDTO } from '@/types/DTO';
import { OcrDetectionLanguage } from '@azure/cognitiveservices-computervision/esm/models';

/**
 * Node modules
 */
import type { Response } from 'express';

export interface IAzureFreeSubscriptionService {
  extractTextFromFile(data: ExtractTextReqDTO): Promise<ExtractTextResDTO>;
  
  translateText(
    text: ExtractTextResDTO,
    toLang: OcrDetectionLanguage,
  ): Promise<string>;

  processFreeUserDocument(params: {
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
