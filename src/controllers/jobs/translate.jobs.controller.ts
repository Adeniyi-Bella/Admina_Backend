import { ApiResponse } from '@/lib/api_response';
import type { Request, Response } from 'express';
import { logger } from '@/lib/winston';
import redis from '@/lib/redis';
import { PollRequestReponse } from '@/types';
import {
  AppError,
  ErrorSerializer,
  InternalServerError,
  JobNotFoundError,
} from '@/lib/api_response/error';

export const getJobStatusController = async (req: Request, res: Response) => {
  const jobId = req.params.jobId;
  const jobKey = `job:${jobId}`;

  try {
    const job = await redis.hgetall(jobKey);

    if (!job || Object.keys(job).length === 0) {
      logger.warn(`Job status requested for non-existent or expired key`, {
        jobId,
      });
      throw new JobNotFoundError(
        `Job details for ${jobId} not found or expired.`,
      );
    }
    const response: PollRequestReponse = {
      docId: job.docId,
      status: job.status,
      error: job.error,
    };

    return ApiResponse.ok(res, 'Job status retrieved', response);
  } catch (error: any) {
    logger.error('Error fetching job status', {
      error: ErrorSerializer.serialize(error),
    });
    if (error instanceof AppError) {
      throw error;
    }
    throw new InternalServerError(
      'An error occurred during document processing. Please try again later',
    );
  }
};
