/**
 * @copyright 2025 Adeniyi Bella
 * @license Apache-2.0
 */

/**
 * Node modules
 */
import * as express from 'express';

/**
 * Types
 */
import { Types } from 'mongoose';

declare global {
  namespace Express {
    interface Request {
      userId: string;
      email: string;
      username: string;

    }
  }
}
