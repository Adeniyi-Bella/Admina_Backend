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

export interface IActionPlanPreview {
  title?: string;
  dueDate?: string | Date;
  completed?: boolean;
  location?: string;
}

export interface IDocumentPreview {
  docId: string;
  title?: string;
  sender?: string;
  receivedDate?: Date;
  actionPlans?: IActionPlanPreview[];
}