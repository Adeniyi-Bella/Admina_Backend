/**
 * @copyright 2025 Adeniyi Bella
 * @license Apache-2.0
 */

/**
 * Types
 */
import { BadRequestError } from '@/lib/api_response/error';
import type { Request, Response, NextFunction } from 'express';

const verifyUploadedFile = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {

  if (!req.file) {
    throw new BadRequestError(
      'No file uploaded. Please include a PDF, PNG, or JPEG file.',
    );
  }

  next();
};

export default verifyUploadedFile;
