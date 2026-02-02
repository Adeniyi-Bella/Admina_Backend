import { Queue } from 'bullmq';
import redis from '@/lib/redis';
import { logger } from '@/lib/winston';
import { JobData } from '@/types';
import {
  ServiceUnavailableError,
  TooManyRequestsError,
} from '@/lib/api_response/error';

export class TranslateQueueService {
  // --- Class Properties (Config) ---
  private readonly queueName = 'translation-queue';
  private readonly maxQueueLength = 100;

  // BullMQ requires its own connection settings
  private readonly connectionOptions = {
    host: '127.0.0.1',
    port: 6379,
  };

  private queue: Queue;

  constructor() {
    // Initialize BullMQ Queue with specific connection options
    this.queue = new Queue(this.queueName, {
      connection: this.connectionOptions,
    });
  }

  /**
   * ATOMIC DISTRIBUTED LOCK
   * Uses Redis SET with NX flag to ensure only one process wins.
   */
  private async acquireUserLock(email: string): Promise<boolean> {
    const lockKey = `lock:user:${email}`;
    // SET if Not eXists, Expire in 600 seconds
    const result = await redis.set(lockKey, 'true', 'EX', 600, 'NX');
    return result === 'OK';
  }

  public async releaseUserLock(email: string) {
    await redis.del(`lock:user:${email}`);
  }

  /**
   * Check if user has an active lock in your existing Redis instance
   */
  // public async isUserProcessing(email: string): Promise<boolean> {
  //   const lock = await redis.get(`lock:user:${email}`);
  //   return !!lock;
  // }

  /**
   * Add translation job to BullMQ
   */
  public async addTranslationJob(docId: string, data: JobData, email: string) {
    const workers = await this.queue.getWorkers();

    if (workers.length === 0) {
      throw new ServiceUnavailableError(
        'Our Document processor service is down. Please try again later',
      );
    }

    // 2. ATOMIC LOCKING
    // This prevents the race condition where 2 requests check if processing at once
    const lockAcquired = await this.acquireUserLock(email);
    if (!lockAcquired) {
      throw new TooManyRequestsError(
        'You already have a document being processed.',
      );
    }

    try {
      // 3. Queue Capacity Check
      const counts = await this.queue.getJobCounts('waiting', 'active');
      if (counts.waiting + counts.active >= this.maxQueueLength) {
        throw new TooManyRequestsError(
          'Server busy. Please try again in a few minutes.',
        );
      }

      // 4. Set Initial Status Metadata
      const jobKey = `job:${docId}`;
      await redis.hset(jobKey, { docId, status: 'queued' });
      await redis.expire(jobKey, 3600);

      // 5. Add to BullMQ with Idempotency
      // jobId: docId ensures that even if the lock fails, BullMQ won't double-process the same doc
      await this.queue.add('translate-document', data, {
        jobId: docId,
        attempts: 1,
        backoff: { type: 'exponential', delay: 1000 },
        removeOnComplete: true,
        removeOnFail: true,
      });

      logger.info(`Job successfully queued`, { docId, user: email });
    } catch (error) {
      //  If queuing fails for any reason, release the user lock
      // so they aren't stuck for 10 minutes.
      await this.releaseUserLock(email);
      logger.error('Failed to add job to queue', { docId, error });
      throw error;
    }
  }
}
