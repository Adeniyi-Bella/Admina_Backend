/**
 * @copyright 2025 Adeniyi Bella
 * @license Apache-2.0
 */

/**
 * Node modules
 */
import { Router } from 'express';
import multer from 'multer';
import { body, param, query } from 'express-validator';

/**
 * Middlewares
 */
import authenticate from '@/middlewares/authenticate';
import validationError from '@/middlewares/validationError';
import verifyUploadedFile from '@/middlewares/verifyUploadedFile';
import  resetPropertiesIfNewMonth from '@/middlewares/resetPropertiesIfNewMonth';

/**
 * Controllers
 */
import getAllDocuments from '@/controllers/document/getAllDocument';
import createDocument from '@/controllers/document/createDocument';
import getDocument from '@/controllers/document/getDocument';
import deleteDocument from '@/controllers/document/deleteDocument';
import updateActionPlan from '@/controllers/document/update-document/updateActionPlan';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_, file, cb) => {
    const allowedFileTypes = ['application/pdf', 'image/png', 'image/jpeg'];
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

router.use(authenticate);
router.use(resetPropertiesIfNewMonth);


// Route to get all documents with optional pagination
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
  getAllDocuments,
);

// Route to get a specific document by ID
router.get(
  '/:docId',
  param('docId').notEmpty().isUUID().withMessage('Invalid doId ID'),
  validationError,
  getDocument,
);

// Route to create a new document
// Requires authentication and file upload
// Used by the scan and translate feature
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
    .withMessage('Must be a valid language code')
    .custom((value, { req }) => {
      if (value === req.body.docLanguage) {
        throw new Error(
          'Target language must be different from source language',
        );
      }
      return true;
    }),
  validationError,
  createDocument,
);

router.delete(
  '/:docId',
  param('docId').notEmpty().isUUID().withMessage('Invalid docId ID'),
  validationError,
  deleteDocument,
);

// Route to handle create, update, delete of action plans
router.patch(
  '/actionPlan/:docId/:id',
  param('docId').notEmpty().isUUID().withMessage('Invalid docId'),
  param('id').notEmpty().isUUID().withMessage('Invalid actionPlan id'),
  query('type')
    .notEmpty().withMessage('type query parameter is required')
    .isIn(['create', 'update', 'delete']).withMessage('type must be one of create, update, or delete'),
  validationError,
  updateActionPlan,
);


export default router;
