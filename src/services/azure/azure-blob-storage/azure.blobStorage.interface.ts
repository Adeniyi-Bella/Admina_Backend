/**
 * @copyright 2025 Adeniyi Bella
 * @license Apache-2.0
 */

/**
 * Node modules
 */
import type { Readable } from 'stream';

/**
 * Types
 */
export interface IUploadedFile {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
  stream: Readable;
  destination: string;
  filename: string;
  path: string;
}

export interface IAzureBlobService {
  /**
   * Upload a PDF file to Azure Blob Storage.
   * @param containerName - The Azure Blob container name.
   * @param file - The file to upload.
   * @param blobName - The blob name in storage.
   */
  uploadPdfToBlob(
    containerName: string,
    file: IUploadedFile,
    blobName: string,
  ): Promise<void>;

  /**
   * Download a PDF file from Azure Blob Storage.
   * @param containerName - The Azure Blob container name.
   * @param blobName - The blob name in storage.
   * @returns The downloaded file object.
   * @throws If the blob does not exist or download fails.
   */
  downloadPdfFromBlob(
    containerName: string,
    // userContainerName: string,
    blobName: string,
  ): Promise<IUploadedFile>;

  /**
   * Delete a blob from Azure Blob Storage.
   * @param containerName - The Azure Blob container name.
   * @param blobName - The blob name in storage.
   */
  deleteBlob(
    containerName: string,
    // userContainerName: string,
    blobName: string,
  ): Promise<void>;
}
