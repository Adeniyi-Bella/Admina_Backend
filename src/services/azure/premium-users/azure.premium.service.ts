// /**
//  * @copyright 2025 Adeniyi Bella
//  * @license Apache-2.0
//  */

// /**
//  * Interfaces
//  */
// import { IAzurePremiumSubscriptionService } from './azure.premium.interface';

// /**
//  * Node modules
//  */
// import { injectable } from 'tsyringe';
// import type { Response } from 'express';
// import { v4 as uuidv4 } from 'uuid';
// import {
//   BlobSASPermissions,
//   BlobServiceClient,
//   generateBlobSASQueryParameters,
//   SASProtocol,
//   StorageSharedKeyCredential,
// } from '@azure/storage-blob';

// /**
//  * Custom modules
//  */
// import { container } from 'tsyringe';
// import config from '@/config';
// import { logger } from '@/lib/winston';
// import axios from 'axios';
// import { OcrDetectionLanguage } from '@azure/cognitiveservices-computervision/esm/models';
// import { AzureSubscriptionBase } from '../base-class/azure.service';
// import { handleSseAsyncOperation, sendSseMessage } from '../utils';
// import { IOpenAIService } from '@/services/ai-models/openai.interface';
// import { IDocument } from '@/models/document.model';
// import { IDocumentService } from '@/services/document/document.interface';
// import { IUserService } from '@/services/users/user.interface';
// import { IChatBotService } from '@/services/chatbot/chatbot.interface';
// import { IAzureBlobService } from '../azure-blob-storage/azure.blobStorage.interface';

// @injectable()
// export class AzurePremiumSubscriptionService
//   extends AzureSubscriptionBase
//   implements IAzurePremiumSubscriptionService
// {
//   private blobServiceClient: BlobServiceClient;
//   private readonly containerNameForUpload = 'upload';
//   private readonly containerNameForDownload = 'download';
//   private sharedKeyCredential: StorageSharedKeyCredential;
//   private translatedPdfBuffer?: Express.Multer.File;
//   private azureBlobService =
//     container.resolve<IAzureBlobService>('IAzureBlobService');

//   constructor() {
//     super();

//     // Initialize Azure Blob Service Client
//     const connectionString = config.AZURE_STORAGE_ACCOUNT_CONNECTION_STRING;
//     this.blobServiceClient =
//       BlobServiceClient.fromConnectionString(connectionString);

//     // Initialize SharedKeyCredential for SAS token generation
//     const accountName = config.AZURE_STORAGE_ACCOUNT_NAME;
//     const accountKey = config.AZURE_STORAGE_ACCOUNT_KEY;
//     this.sharedKeyCredential = new StorageSharedKeyCredential(
//       accountName,
//       accountKey,
//     );
//   }

//   async translateDocument(
//     userId: string,
//     blobName: string,
//     targetLanguage: string,
//   ): Promise<boolean> {
//     try {
//       const premiumTranslateKey = config.PREMIUM_PLAN_TRANSLATE_KEY;
//       const premiumTranslateEndpoint = config.PREMIUM_PLAN_TRANSLATE_ENDPOINT;
//       const containerClient = this.blobServiceClient.getContainerClient(
//         this.containerNameForUpload,
//       );
//       const blockBlobClient = containerClient.getBlockBlobClient(blobName);

//       // Generate SAS token for source container (read permission)
//       const sourceSasPermissions = new BlobSASPermissions();
//       sourceSasPermissions.read = true;
//       const sourceSas = generateBlobSASQueryParameters(
//         {
//           containerName: this.containerNameForUpload,
//           blobName,
//           permissions: sourceSasPermissions,
//           startsOn: new Date(),
//           expiresOn: new Date(new Date().valueOf() + 3600 * 1000),
//           protocol: SASProtocol.HttpsAndHttp,
//         },
//         this.sharedKeyCredential,
//       ).toString();
//       const sourceUrl = `${blockBlobClient.url}?${sourceSas}`;

//       // Generate SAS token for target container (write permission)
//       const targetContainerClient = this.blobServiceClient.getContainerClient(
//         this.containerNameForDownload,
//       );
//       await targetContainerClient.createIfNotExists({ access: 'container' });
//       const targetSasPermissions = new BlobSASPermissions();
//       targetSasPermissions.write = true;
//       targetSasPermissions.read = true;
//       const targetSas = generateBlobSASQueryParameters(
//         {
//           containerName: this.containerNameForDownload,
//           permissions: targetSasPermissions,
//           startsOn: new Date(),
//           expiresOn: new Date(new Date().valueOf() + 3600 * 1000),
//           protocol: SASProtocol.HttpsAndHttp,
//         },
//         this.sharedKeyCredential,
//       ).toString();
//       const userBlobName = `${userId}/${blobName}`;
//       const targetUrl = `${targetContainerClient.url}/${userBlobName}?${targetSas}`;

//       const postResponse = await axios.post(
//         `${premiumTranslateEndpoint}translator/document/batches?api-version=2024-05-01`,
//         {
//           inputs: [
//             {
//               storageType: 'File',
//               source: { sourceUrl, storageSource: 'AzureBlob' },
//               targets: [
//                 {
//                   targetUrl,
//                   storageSource: 'AzureBlob',
//                   category: 'general',
//                   language: targetLanguage,
//                 },
//               ],
//             },
//           ],
//         },
//         {
//           headers: {
//             'Ocp-Apim-Subscription-Key': premiumTranslateKey,
//             'Content-Type': 'application/json',
//           },
//           validateStatus: () => true,
//         },
//       );

//       const operationLocation = postResponse.headers['operation-location'];
//       if (!operationLocation) {
//         logger.error('No operation-location returned by Azure');
//         throw new Error('Internal server error');
//       }

//       // Poll until translation completes
//       let isCompleted = false;
//       let attempts = 0;
//       const maxAttempts = 30;
//       const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));

//       while (!isCompleted && attempts < maxAttempts) {
//         const pollResponse = await axios.get(operationLocation, {
//           headers: {
//             'Ocp-Apim-Subscription-Key': premiumTranslateKey,
//           },
//         });

//         const status = pollResponse.data.status;
//         if (status === 'Succeeded') {
//           isCompleted = true;

//           await this.azureBlobService.deleteBlob(
//             this.containerNameForUpload,
//             blobName,
//           );

//           break;
//         } else if (status === 'Failed' || status === 'ValidationFailed') {
//           throw new Error(`Translation failed with status: ${status}`);
//         }

//         attempts++;
//         await delay(5000);
//       }

//       if (!isCompleted) {
//         throw new Error('Translation did not complete within expected time');
//       }

//       logger.info('Translation completed successfully for blob:', { blobName });
//       return true;
//     } catch (error: any) {
//       logger.error('Error translating document', { error: error.message });
//       throw new Error('Internal server error');
//     }
//   }


//   public async processPremiumUserDocument(params: {
//     file: Express.Multer.File;
//     docLanguage: OcrDetectionLanguage;
//     targetLanguage: string;
//     userId: string;
//     res: Response;
//     openAIService: IOpenAIService;
//     documentService: IDocumentService;
//     userService: IUserService;
//     chatBotService: IChatBotService;
//   }): Promise<void> {
//     const {
//       file,
//       docLanguage,
//       targetLanguage,
//       res,
//       openAIService,
//       userId,
//       documentService,
//       userService,
//       chatBotService,
//     } = params;

//     // Validate file
//     if (!file?.buffer || !(file.buffer instanceof Buffer)) {
//       logger.error('Invalid input: A valid document file buffer is required', {
//         userId,
//       });
//       throw new Error('A valid document file buffer is required');
//     }

//     // Reset translatedPdfBuffer at the start of processing
//     this.translatedPdfBuffer = undefined;

//     // Send initial event
//     sendSseMessage(res, 'message', 'Uploading document...');

//     const docId = uuidv4();
//     // const fileToBeUploaded= `${uuidv4()}.pdf`

//     // Upload original PDF to Azure Blob Storage
//     await handleSseAsyncOperation(
//       res,
//       () =>
//         this.azureBlobService.uploadPdfToBlob(
//           this.containerNameForUpload,
//           file,
//           docId,
//         ),
//       'Failed to upload PDF',
//     );
//     sendSseMessage(res, 'uploaded', { status: 'Document uploaded' });

//     // Translate document
//     const isDocumentTranslated = await handleSseAsyncOperation(
//       res,
//       () => this.translateDocument(userId, docId, targetLanguage),
//       'Failed to translate document',
//     );
//     sendSseMessage(res, 'translated', { status: 'Document translated' });

//     // Download translated PDF
//     if (isDocumentTranslated) {
//       this.translatedPdfBuffer = await handleSseAsyncOperation(
//         res,
//         () =>
//           this.azureBlobService.downloadPdfFromBlob(
//             this.containerNameForDownload,
//             `${userId}/${docId}`
//           ),
//         'Failed to download translated PDF',
//       );
//       sendSseMessage(res, 'downloaded', {
//         status: 'Translated document downloaded',
//       });
//     } else {
//       logger.error('Document translation not completed', { userId, docId });
//       throw new Error('Internal server error');
//     }

//     // Check if translatedPdfBuffer is set
//     if (!this.translatedPdfBuffer) {
//       logger.error('Translated PDF buffer not available', { userId, docId });
//       throw new Error('Internal server error');
//     }

//     // Extract text from translated PDF
//     const extractedText = await handleSseAsyncOperation(
//       res,
//       () =>
//         this.extractTextFromFile({
//           file: this.translatedPdfBuffer!,
//           docLanguage,
//           plan: 'premium',
//         }),
//       'Failed to extract text from translated document',
//     );
//     sendSseMessage(res, 'extractedText', { extractedText: extractedText.text });

//     // Add translated text to chatbot history collection
//     await chatBotService.addTranslatedText({
//       userId: userId.toString(),
//       docId,
//       translatedText: extractedText.text,
//     });

//     // Summarize translated text
//     const summarizedText = await handleSseAsyncOperation(
//       res,
//       () =>
//         openAIService.summarizeTranslatedText(
//           extractedText.text,
//           targetLanguage,
//         ),
//       'Failed to summarize translated text',
//     );
//     sendSseMessage(res, 'summarizedText', { summarizedText });

//     // Validate summarizedText
//     if (!summarizedText.summary || summarizedText.summary.includes('Failed')) {
//       logger.error('Invalid summary generated', { userId, docId });
//       throw new Error('Failed to generate valid summary');
//     }

//     // Create document in MongoDB
//     const documentData: IDocument = {
//       userId: userId.toString(),
//       docId,
//       title: summarizedText.title || '',
//       sender: summarizedText.sender || '',
//       receivedDate: summarizedText.receivedDate || new Date(),
//       summary: summarizedText.summary || '',
//       targetLanguage,
//       actionPlan: summarizedText.actionPlan || [],
//       actionPlans: (summarizedText.actionPlans || []).map((plan: any) => ({
//         id: plan.id || uuidv4(),
//         title: plan.title || '',
//         dueDate: plan.dueDate || new Date(),
//         completed: plan.completed ?? false,
//         location: plan.location || '',
//       })),
//       pdfBlobStorage: true
//     };

//     const documentCreated = await handleSseAsyncOperation(
//       res,
//       () => documentService.createDocumentByUserId(documentData),
//       'Failed to create document in MongoDB',
//     );
//     sendSseMessage(res, 'createdDocument', {
//       status: 'Document created in MongoDB',
//     });

//     // Update lengthOfDocs
//     await handleSseAsyncOperation(
//       res,
//       () => userService.updateUser(userId, 'lengthOfDocs.premium.current', true, undefined),
//       'Failed to update lengthOfDocs for user',
//     );

//     // Signal completion
//     sendSseMessage(res, 'complete', { document: documentCreated.summary });

//     // Clear translatedPdfBuffer after processing
//     this.translatedPdfBuffer = undefined;
//   }
// }
