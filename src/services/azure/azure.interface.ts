/**
 * @copyright 2025 Adeniyi Bella
 * @license Apache-2.0
 */

/**
 * Types
 */
import { ExtractTextReqDTO, ExtractTextResDTO } from '@/types/DTO';
import { OcrDetectionLanguage } from '@azure/cognitiveservices-computervision/esm/models';

export interface IAzureService {
  extractTextFromFile(data: ExtractTextReqDTO): Promise<ExtractTextResDTO>;
  translateText(text: ExtractTextResDTO, toLang: OcrDetectionLanguage): Promise<string>;
}
