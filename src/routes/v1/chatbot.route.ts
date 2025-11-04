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
import resetPropertiesIfNewMonth from '@/middlewares/resetPropertiesIfNewMonth';
import adminaChatBot from '@/controllers/chatbot/chatbot.controller';

/**
 * Controllers
 */


const router = Router();

router.use(authenticate);
router.use(resetPropertiesIfNewMonth);

// Chatbot route
// Receives everytime the structured document content and the current userPrompt
// Saves previous userPrompts and documents on the server and uses in the next userPrompt request
router.patch(
  '/:docId',
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