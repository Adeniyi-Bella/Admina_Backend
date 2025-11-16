// import { injectable } from 'tsyringe';
// import { BlobServiceClient } from '@azure/storage-blob';
// import { Readable } from 'stream';
// import config from '@/config';
// import { logger } from '@/lib/winston';
// import { IAzureBlobService } from './azure.blobStorage.interface';

// @injectable()
// export class AzureBlobService implements IAzureBlobService {
//   private blobServiceClient: BlobServiceClient;

//   constructor() {
//     const connectionString = config.AZURE_STORAGE_ACCOUNT_CONNECTION_STRING;
//     this.blobServiceClient =
//       BlobServiceClient.fromConnectionString(connectionString);
//   }

//   async uploadPdfToBlob(
//     containerName: string,
//     file: Express.Multer.File,
//     blobName: string,
//   ): Promise<void> {
//     try {
//       const containerClient =
//         this.blobServiceClient.getContainerClient(containerName);
//       await containerClient.createIfNotExists({ access: 'container' });
//       const blockBlobClient = containerClient.getBlockBlobClient(blobName);
//       await blockBlobClient.uploadData(file.buffer, {
//         blobHTTPHeaders: { blobContentType: 'application/pdf' },
//       });
//       logger.info('Uploaded PDF to Azure Blob Storage', {
//         containerName,
//         blobName,
//       });
//     } catch (error: any) {
//       logger.error('Error uploading PDF to blob', {
//         containerName,
//         blobName,
//         error: error.message,
//       });
//       throw new Error('Failed to upload PDF to blob');
//     }
//   }

//   async downloadPdfFromBlob(
//     containerName: string,
//     blobName: string,
//   ): Promise<Express.Multer.File> {
//     try {
//       const containerClient =
//         this.blobServiceClient.getContainerClient(containerName);
//       const blockBlobClient = containerClient.getBlockBlobClient(blobName);
//       const downloadResponse = await blockBlobClient.download();
//       const buffer = await this.streamToBuffer(
//         downloadResponse.readableStreamBody!,
//       );

//       return {
//         fieldname: 'file',
//         originalname: `${blobName}`,
//         encoding: '7bit',
//         mimetype: 'application/pdf',
//         size: buffer.length,
//         buffer,
//         stream: Readable.from(buffer),
//         destination: '',
//         filename: '',
//         path: '',
//       };
//     } catch (error: any) {
//       logger.error('Error downloading PDF from blob', {
//         containerName,
//         blobName,
//         error: error.message,
//       });
//       throw new Error('Internal server error');
//     }
//   }

//   async deleteBlob(
//     containerName: string,
//     blobName: string,
//   ): Promise<void> {
//     try {
//       const containerClient =
//         this.blobServiceClient.getContainerClient(containerName);
//       await containerClient.deleteBlob(blobName);
//       logger.info('Deleted blob from container', {
//         containerName,
//         blobName,
//       });
//     } catch (error: any) {
//       logger.error('Failed to delete blob', {
//         containerName,
//         blobName,
//         error: error.message,
//       });
//     }
//   }

//   private async streamToBuffer(
//     readableStream: NodeJS.ReadableStream,
//   ): Promise<Buffer> {
//     return new Promise((resolve, reject) => {
//       const chunks: Buffer[] = [];
//       readableStream.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
//       readableStream.on('end', () => resolve(Buffer.concat(chunks)));
//       readableStream.on('error', reject);
//     });
//   }
// }
