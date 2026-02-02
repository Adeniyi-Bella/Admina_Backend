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
import { getJobStatusController } from '@/controllers/jobs/translate.jobs.controller';

const router = Router();

router.use(authenticate);

router.get('/:jobId/status', getJobStatusController);

export default router;
