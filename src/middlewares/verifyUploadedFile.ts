/**
 * @copyright 2025 Adeniyi Bella
 * @license Apache-2.0
 */

/**
 * Types
 */
import type { Request, Response, NextFunction } from 'express';

const verifyUploadedFile = (req: Request, res: Response, next: NextFunction) => {
//   const errors = validationResult(req);

  if (!req.file) {
    res.status(400).json({
      code: 'Bad Request',
      error: 'No file uploaded. Please include a PDF, PNG, or JPEG file.',
    });
    return;
  }

  next();
};

export default verifyUploadedFile;
