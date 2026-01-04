import { ApiResponse } from '@/lib/api_response';
import type { Request, Response } from 'express';
import { logger } from '@/lib/winston';
import redis from '@/lib/redis';


export const getJobStatusController = async (req: Request, res: Response) => {
  try {
    const jobId = req.params.jobId;
    const jobKey = `job:${jobId}`;
    const job = await redis.hgetall(jobKey);

   if (!job || Object.keys(job).length === 0) {
      return ApiResponse.notFound(res, 'Job not found');
    }

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
