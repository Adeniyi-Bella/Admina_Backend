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
import { ValidationError } from '@/lib/api_response/error';

 const validationError = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    throw new ValidationError('Validation failed', errors.mapped());
  }

  next();
};

export default validationError;
