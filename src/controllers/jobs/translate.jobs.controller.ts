import { ApiResponse } from '@/lib/api_response';
import type { Request, Response } from 'express';
import { TranslateQueueService } from '@/services/ai-models/jobs/job-queues.service';
import { logger } from '@/lib/winston';

const queueService = new TranslateQueueService();

export const getJobStatusController = async (req: Request, res: Response) => {
  try {
    const jobId = req.params.jobId;
    const job = await queueService.getJobStatus(jobId);

    if (!job) return ApiResponse.notFound(res, 'Job not found');

    if (!job.docId) {
      logger.error(`Job ${jobId} exists in Redis but docId is missing`);
      return ApiResponse.serverError(res, 'Job corrupted: missing docId');
    }

    const response: any = {
      docId: job.docId,
      status: job.status,
    };

    if (job.status === 'error' && job.error) {
      response.error = job.error;
    }

    logger.info(`Job ${jobId} status retrieved`, { status: job.status });

    return ApiResponse.ok(res, 'Job status retrieved', response);
  } catch (error: any) {
    logger.error('Error fetching job status', error);
    return ApiResponse.serverError(
      res,
      'Failed to fetch job status',
      error.message,
    );
  }
};
