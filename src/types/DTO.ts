import { OcrDetectionLanguage } from "@azure/cognitiveservices-computervision/esm/models";

export interface ExtractTextReqDTO {
  file: Express.Multer.File;
  docLanguage: OcrDetectionLanguage;
}
export interface ExtractTextResDTO {
  text: string;
}
export interface TranslatedTextDTO {
  text: string;
}