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
import resetPropertiesIfNewMonth from '@/middlewares/resetPropertiesIfNewMonth';
import upgradeUserPlan from '@/controllers/user/upgradeUserPlan';
import downgradeUserPlan from '@/controllers/user/downgradeUserPlan';
import deleteUser from '@/controllers/user/deleteUser';
import { param } from 'express-validator';

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

router.delete('/', resetPropertiesIfNewMonth, deleteUser);

export default router;
