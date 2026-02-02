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
import validationError from '@/middlewares/validationError';

/**
 * Controllers
 */
import { param } from 'express-validator';
import {
  changeUserPlan,
  createUser,
  deleteUser,
  getUserDetails,
} from '@/controllers/user/user.controller';
import authenticate from '@/middlewares/authenticate';
import { getAllDocuments } from '@/controllers/document/document.controller';

const router = Router();

router.use(authenticate);

// Create a new user and or getAll documents for existing user
router.get('/', validationError, createUser, getAllDocuments);

// upgrade userplan
router.patch(
  '/plan/:plan',
  param('plan')
    .isString()
    .withMessage('Invalid plan. Plan must be a string.')
    .notEmpty()
    .withMessage('Invalid plan. Plan must not be empty.')
    .isLength({ min: 4, max: 8 })
    .withMessage('Invalid plan. Plan must be between 4 and 8 characters long.')
    .isIn(['free','premium', 'standard'])
    .withMessage(
      'Invalid plan. Plan must be one of the following: free, premium, standard.',
    ),
  validationError,
  changeUserPlan,
);

router.get('/plan', validationError, getUserDetails);

router.delete('/', deleteUser);

export default router;
