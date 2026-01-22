import { Queue } from 'bullmq';
import redis from '@/lib/redis';
import { logger } from '@/lib/winston';
import { JobData } from '@/types';

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
   * Check if user has an active lock in your existing Redis instance
   */
  public async isUserProcessing(email: string): Promise<boolean> {
    const lock = await redis.get(`lock:user:${email}`);
    return !!lock;
  }

  /**
   * Add translation job to BullMQ
   */
  public async addTranslationJob(docId: string, data: JobData, email: string) {

    const workers = await this.queue.getWorkers();

    if (workers.length === 0) {
      throw new Error('WORKER_OFFLINE');
    }
    // 1. Check Max Queue Length (Logic for Error 429)
    const counts = await this.queue.getJobCounts('waiting', 'active');
    const currentLoad = counts.waiting + counts.active;

    if (currentLoad >= this.maxQueueLength) {
      throw new Error('QUEUE_FULL');
    }

    // 2. Set User Lock (using your existing redis instance)
    // Expires in 10 mins (600s) to prevent permanent deadlocks
    await redis.set(`lock:user:${email}`, 'true', 'EX', 600);

    // 3. Set Initial Job Status
    const jobKey = `job:${docId}`;
    await redis.hset(jobKey, { docId, status: 'queued' });
    await redis.expire(jobKey, 60 * 60); // 1 hour TTL

    // 4. Add to BullMQ with Retry & Backoff
    await this.queue.add('translate-document', data, {
      jobId: docId,
      attempts: 1, // Retry 3 times
      backoff: {
        type: 'exponential',
        delay: 1000, // 1s, 2s, 4s...
      },
      removeOnComplete: true,
      removeOnFail: 500,
    });

    logger.info(`Job added to queue`, { docId, user: email });
  }

  /**
   * Force release lock (used in catch blocks in controller)
   */
  public async releaseUserLock(email: string) {
    await redis.del(`lock:user:${email}`);
  }
}
