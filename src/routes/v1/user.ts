/**
 * @copyright 2025 Adeniyi Bella
 * @license Apache-2.0
 */

/**
 * Node modules
 */
import { Router } from 'express';

/**
 * Middlewares
 */
import authenticate from '@/middlewares/authenticate';
import validationError from '@/middlewares/validationError';

/**
 * Controllers
 */
import createUser from '@/controllers/user/create_user';
import getAllDocuments from '@/controllers/document/getAllDocument';

const router = Router();

router.post(
  '/',
  authenticate,
  validationError,
  createUser,
  getAllDocuments
);

export default router;
