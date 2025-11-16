// import { ComputerVisionClient } from '@azure/cognitiveservices-computervision';
// import { OcrDetectionLanguage, ReadResult } from '@azure/cognitiveservices-computervision/esm/models';
// import { ApiKeyCredentials } from '@azure/ms-rest-js';
// import { logger } from '@/lib/winston';
// import { ExtractTextReqDTO, ExtractTextResDTO } from '@/types/DTO';
// import config from '@/config';

// export class AzureSubscriptionBase {
//   private readonly client: ComputerVisionClient;
//   private readonly pollingIntervalMs: number = 1000;
//   private readonly maxPollingAttempts: number = 30;

//   constructor() {

//     const ocrExtractionKey = config.OCR_TEXT_EXTRACTION_KEY;
//     const ocrExtractionEndpoint = config.OCR_TEXT_EXTRACTION_ENDPOINT;
    
//     if (!ocrExtractionKey || !ocrExtractionEndpoint) {
//       logger.error('Invalid configuration: Azure Computer Vision key or endpoint missing');
//       throw new Error('Azure Computer Vision key and endpoint are required');
//     }

//     this.client = new ComputerVisionClient(
//       new ApiKeyCredentials({
//         inHeader: { 'Ocp-Apim-Subscription-Key': ocrExtractionKey },
//       }),
//       ocrExtractionEndpoint
//     );
//   }

//   private sleep(ms: number): Promise<void> {
//     return new Promise((resolve) => setTimeout(resolve, ms));
//   }

//   public async extractTextFromFile(data: ExtractTextReqDTO): Promise<ExtractTextResDTO> {
//     try {
//       if (!data.file?.buffer || !(data.file.buffer instanceof Buffer)) {
//         logger.error('Invalid input: A valid document file buffer is required');
//         throw new Error('A valid document file buffer is required');
//       }
//       if (!data.docLanguage) {
//         logger.error('Invalid input: A valid source language is required');
//         throw new Error('A valid source language is required');
//       }

//       const readResults = await this.readTextFromStream(data.file.buffer, data.docLanguage);

//       const text = this.extractTextFromResults(readResults);

//       if (!text) {
//         logger.error('No text extracted: The file may not contain readable text');
//         throw new Error('No text was extracted from the file. The file may not contain readable text.');
//       }

//       return { text };
//     } catch (error: any) {
//       logger.error('Text extraction failed', error.message);
//       throw new Error('Internal server error');
//     }
//   }

//   private async readTextFromStream(buffer: Buffer, language: OcrDetectionLanguage): Promise<ReadResult[]> {
//     try {
//       const operationResponse = await this.client.readInStream(buffer, { language });
//       const operationId = operationResponse.operationLocation?.split('/').pop();

//       if (!operationId) {
//         logger.error('Failed to retrieve operation ID from Azure Read API response');
//         throw new Error('Internal server error');
//       }

//       let attempts = 0;
//       while (attempts < this.maxPollingAttempts) {
//         const result = await this.client.getReadResult(operationId);

//         if (result.status === 'succeeded') {
//           return result.analyzeResult?.readResults ?? [];
//         }
//         if (result.status === 'failed') {
//           logger.error('Text extraction operation failed');
//           throw new Error('Internal server error');
//         }

//         await this.sleep(this.pollingIntervalMs);
//         attempts++;
//       }

//       logger.error(`Text extraction timed out after ${this.maxPollingAttempts} attempts`);
//       throw new Error('Internal server error');
//     } catch (error: any) {
//       logger.error('Text extraction failed', error.message);
//       throw new Error('Internal server error');
//     }
//   }

//   private extractTextFromResults(readResults: ReadResult[]): string {
//     return readResults
//       .flatMap((page) => page.lines?.map((line) => line.words.map((word) => word.text).join(' ')) ?? [])
//       .join('\n')
//       .trim();
//   }
// }