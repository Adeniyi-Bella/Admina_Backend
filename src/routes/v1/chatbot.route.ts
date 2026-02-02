/**
 * @copyright 2025 Adeniyi Bella
 * @license Apache-2.0
 */

/**
 * Node modules
 */
import { Router } from 'express';
import { body, param } from 'express-validator';

/**
 * Middlewares
 */
import authenticate from '@/middlewares/authenticate';
import validationError from '@/middlewares/validationError';
import adminaChatBot from '@/controllers/chatbot/chatbot.controller';
import multer from 'multer';

/**
 * Controllers
 */


const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 1 * 1024 * 1024 }, // Limit file size to 1MB (optional safety)
});

router.use(authenticate);


router.patch(
  '/:docId',
  upload.single('file'), 
  param('docId').notEmpty().isUUID().withMessage('Invalid doId ID'),
  body('userPrompt')
    .exists().trim().notEmpty()
    .withMessage('Prompt is required')
    .isString()
    .withMessage('Prompt must be a string'),
  validationError,
  adminaChatBot,
);

export default router;