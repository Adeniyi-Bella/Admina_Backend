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

/**
 * Controllers
 */
import resetPropertiesIfNewMonth from '@/middlewares/resetPropertiesIfNewMonth';
import { getJobStatusController } from '@/controllers/jobs/translate.jobs.controller';

const router = Router();

router.use(authenticate);
router.use(resetPropertiesIfNewMonth);

router.get('/:jobId/status', getJobStatusController);

export default router;
