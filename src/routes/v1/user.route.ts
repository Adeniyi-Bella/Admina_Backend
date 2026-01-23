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
import resetPropertiesIfNewMonth from '@/middlewares/resetPropertiesIfNewMonth';
import { param } from 'express-validator';
import {
  createUser,
  deleteUser,
  downgradeUserPlan,
  getUserDetails,
  upgradeUserPlan,
} from '@/controllers/user/user.controller';
import authenticate from '@/middlewares/authenticate';
import { getAllDocuments } from '@/controllers/document/document.controller';

const router = Router();

router.use(authenticate);

// Create a new user and or getAll documents for existing user
router.post('/', validationError, createUser, getAllDocuments);

// upgrade userplan
router.patch(
  '/plan/upgrade/:plan',
  param('plan')
    .isString()
    .withMessage('Invalid plan. Plan must be a string.')
    .notEmpty()
    .withMessage('Invalid plan. Plan must not be empty.')
    .isLength({ min: 7, max: 8 })
    .withMessage('Invalid plan. Plan must be between 7 and 8 characters long.')
    .isIn(['premium', 'standard'])
    .withMessage(
      'Invalid plan. Plan must be one of the following: premium, standard.',
    ),
  validationError,
  resetPropertiesIfNewMonth,
  upgradeUserPlan,
);
router.patch(
  '/plan/downgrade/:plan',
  param('plan')
    .isString()
    .withMessage('Invalid plan. Plan must be a string.')
    .notEmpty()
    .withMessage('Invalid plan. Plan must not be empty.')
    .isLength({ min: 4, max: 8 })
    .withMessage('Invalid plan. Plan must be between 4 and 8 characters long.')
    .isIn(['free', 'standard'])
    .withMessage(
      'Invalid plan. Plan must be one of the following: free, standard.',
    ),
  validationError,
  resetPropertiesIfNewMonth,
  downgradeUserPlan,
);

router.get('/', validationError, resetPropertiesIfNewMonth, getUserDetails);

router.delete('/', resetPropertiesIfNewMonth, deleteUser);
// router.patch('/logout', validationError, logout);

export default router;
