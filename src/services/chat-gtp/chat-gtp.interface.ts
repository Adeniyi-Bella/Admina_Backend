/**
 * @copyright 2025 Adeniyi Bella
 * @license Apache-2.0
 */

/**
 * Types
 */
import { IDocument } from '@/models/document';

export interface IChatGTPService {
//   summarizeTranslatedText(data: ExtractTextReqDTO): Promise<ExtractTextResDTO>;
  summarizeTranslatedText(
      translatedText: string,
      targetLanguage: string,
    ): Promise<
      Pick<
        IDocument,
        | 'title'
        | 'sender'
        | 'receivedDate'
        | 'summary'
        | 'actionPlan'
        | 'actionPlans'
      >
    >;
}
