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
import  resetPropertiesIfNewMonth  from '@/middlewares/resetPropertiesIfNewMonth';
import upgradeUserPlan from '@/controllers/user/upgradeUserPlan';
import downgradeUserPlan from '@/controllers/user/downgradeUserPlan';
import deleteUser from '@/controllers/user/deleteUser';

const router = Router();

router.use(authenticate);

// Create a new user and or getAll documents for existing user
router.post(
  '/',
  validationError,
  createUser,
  getAllDocuments
);

// upgrade userplan
router.patch(
  '/plan/upgrade',
  resetPropertiesIfNewMonth,
  upgradeUserPlan,
)
router.patch(
  '/plan/downgrade',
  resetPropertiesIfNewMonth,
  downgradeUserPlan,
)

router.delete(
  '/',
  resetPropertiesIfNewMonth,
  deleteUser,
);

export default router;
