import { OcrDetectionLanguage } from "@azure/cognitiveservices-computervision/esm/models";

export interface ExtractTextReqDTO {
  file: Express.Multer.File | undefined;
  docLanguage: OcrDetectionLanguage;
  plan: string; 
}
export interface ExtractTextResDTO {
  text: string;
  // structuredPages: string; 
}

export interface IDocumentResponseFreeUsersDTO {
  receivedDate?: Date;
  docId: string;
  title?: string;
  sender?: string;
  structuredTranslatedText?: Record<string, string>;
  pdfBlobStorage?: boolean;
}