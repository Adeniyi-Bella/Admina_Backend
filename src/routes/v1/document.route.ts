/**
 * @copyright 2025 Adeniyi Bella
 * @license Apache-2.0
 */

import { Router } from 'express';
import { container } from 'tsyringe';
import multer from 'multer';
import { body, param, query } from 'express-validator';
import authenticate from '@/middlewares/authenticate';
import validationError from '@/middlewares/validationError';
import verifyUploadedFile from '@/middlewares/verifyUploadedFile';
import { DocumentController } from '@/controllers/document/document.controller';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 6 * 1024 * 1024 },
  fileFilter: (_, file, cb) => {
    const allowedFileTypes = [
      'application/pdf',
      'image/png',
      'image/jpeg',
      'image/jpg',
    ];
    if (allowedFileTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(
        new Error(
          'Invalid file type. Only PDF, PNG, or JPEG files are allowed.',
        ),
      );
    }
  },
});

// Resolve controller from DI container
const documentController = container.resolve(DocumentController);

router.use(authenticate);

router.get(
  '/',
  query('limit')
    .optional()
    .isInt({ min: 1, max: 50 })
    .withMessage('Limit must be between 1 to 20'),
  query('offset')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Offset must be a positive integer'),
  validationError,
  documentController.getAllDocuments,
);

router.get(
  '/:docId',
  param('docId').notEmpty().isUUID().withMessage('Invalid doId ID'),
  validationError,
  documentController.getDocument,
);

router.get(
  '/:docId/limit',
  param('docId').notEmpty().isUUID().withMessage('Invalid doId ID'),
  validationError,
  documentController.getDocumentChatbotLimit,
);

router.post(
  '/',
  upload.single('file'),
  verifyUploadedFile,
  body('docLanguage')
    .exists()
    .withMessage('Source language is required')
    .isString()
    .withMessage('Source language must be a string')
    .isLength({ min: 2, max: 5 })
    .withMessage('Must be 2–5 characters')
    .matches(/^[a-zA-Z]{2,5}$/)
    .withMessage('Must be a valid language code'),
  body('targetLanguage')
    .exists()
    .withMessage('Target language is required')
    .isString()
    .withMessage('Target language must be a string')
    .isLength({ min: 2, max: 5 })
    .withMessage('Must be 2–5 characters')
    .matches(/^[a-zA-Z]{2,5}$/)
    .withMessage('Must be a valid language code'),
  validationError,
  documentController.createDocument,
);

router.delete(
  '/:docId',
  param('docId').notEmpty().isUUID().withMessage('Invalid docId ID'),
  validationError,
  documentController.deleteDocument,
);

router.patch(
  '/actionPlan/:docId',
  param('docId')
    .notEmpty()
    .isUUID()
    .withMessage('Invalid docId')
    .isString()
    .withMessage('Source language must be a string'),
  query('type')
    .notEmpty()
    .withMessage('type query parameter is required')
    .isIn(['create'])
    .withMessage('type must be create'),
  validationError,
  documentController.updateActionPlan,
);

router.patch(
  '/actionPlan/:docId/:id',
  param('docId')
    .notEmpty()
    .isUUID()
    .withMessage('Invalid docId')
    .isString()
    .withMessage('Source language must be a string'),
  param('id')
    .notEmpty()
    .isUUID()
    .withMessage('Invalid actionPlan id')
    .isString()
    .withMessage('Source language must be a string'),
  query('type')
    .notEmpty()
    .withMessage('type query parameter is required')
    .isIn(['update', 'delete'])
    .withMessage('type must be one of update, or delete'),
  validationError,
  documentController.updateActionPlan,
);

export default router;