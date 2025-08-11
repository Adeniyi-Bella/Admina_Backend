/**
 * @copyright 2025 Adeniyi Bella
 * @license Apache-2.0
 */

/**
 * Node modules
 */
import { validationResult } from 'express-validator';

/**
 * Types
 */
import type { Request, Response, NextFunction } from 'express';
import { ApiResponse } from '@/lib/api_response';

const validationError = (req: Request, res: Response, next: NextFunction) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    ApiResponse.badRequest(res, 'ValidationError.', errors.mapped());
    return;
  }

  next();
};

export default validationError;
