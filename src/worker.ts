import 'reflect-metadata';
import './di/container';
import '@/models/user.model';
import { Worker, Job, WorkerOptions } from 'bullmq';
import { container, inject, injectable } from 'tsyringe';
import redis from '@/lib/redis/redis';
import { logger, logtail } from '@/lib/winston';
import { IGeminiAIService } from '@/services/ai-models/gemini-ai/geminiai.interface';
import { IDocumentService } from '@/services/document/document.interface';
import { IActionPlan, IDocument } from '@/models/document.model';
import { v4 as uuidv4 } from 'uuid';
import { FileMulter, JobData, JobStatus, WelcomeEmailJobData } from './types';
import { connectToDatabase, disconnectFromDatabase } from '@/lib/mongoose';
import { DatabaseError, ErrorSerializer } from './lib/api_response/error';
import fs from 'fs/promises';
import { PlanType } from '@/models/user.model';
import { NotificationService } from './services/notifications/notification.service';
import { BaseRedisHandler } from './lib/redis/redis-base.service';
import { WORKER_CONFIG } from './constants/worker-config.constant';

@injectable()
class BackgroundWorker extends BaseRedisHandler {
  private translationWorker?: Worker<JobData>;
  private welcomeEmailWorker?: Worker<WelcomeEmailJobData>;
  private isShuttingDown = false;
  private abortController = new AbortController();
  private activeJobs = new Map<string, string>();

  constructor(
    @inject('IGeminiAIService')
    private readonly geminiService: IGeminiAIService,
    @inject('IDocumentService')
    private readonly documentService: IDocumentService,
    @inject('NotificationService')
    private readonly notificationService: NotificationService,
  ) {
    super();
    this.initialize();
  }

  /**
   * Initialize all worker components
   */
  private async initialize(): Promise<void> {
    try {
      await this.connectDependencies();
      this.createWorkers();
      this.setupEventListeners();
      this.setupSignalHandlers();

      logger.info('Background workers initialized successfully', {
        translation: {
          queue: WORKER_CONFIG.TRANSLATION.QUEUE_NAME,
          concurrency: WORKER_CONFIG.TRANSLATION.CONCURRENCY,
        },
        welcomeEmail: {
          queue: WORKER_CONFIG.WELCOME_EMAIL.QUEUE_NAME,
          concurrency: WORKER_CONFIG.WELCOME_EMAIL.CONCURRENCY,
        },
      });
    } catch (error) {
      logger.error('Failed to initialize workers', {
        error: ErrorSerializer.serialize(error),
      });
      await this.cleanup();
      process.exit(1);
    }
  }

  /**
   * Connect to required external dependencies
   */
  private async connectDependencies(): Promise<void> {
    await connectToDatabase('Worker');
  }

  /**
   * Create BullMQ worker instances
   */
  private createWorkers(): void {
    this.translationWorker = new Worker<JobData>(
      WORKER_CONFIG.TRANSLATION.QUEUE_NAME,
      this.processTranslationJob.bind(this),
      this.buildWorkerOptions(WORKER_CONFIG.TRANSLATION),
    );

    this.welcomeEmailWorker = new Worker<WelcomeEmailJobData>(
      WORKER_CONFIG.WELCOME_EMAIL.QUEUE_NAME,
      this.processWelcomeEmailJob.bind(this),
      this.buildWorkerOptions(WORKER_CONFIG.WELCOME_EMAIL),
    );
  }

  /**
   * Build standardized worker options
   */
  private buildWorkerOptions(config: {
    CONCURRENCY: number;
    RATE_LIMIT?: { max: number; duration: number };
    MAX_ATTEMPTS: number;
  }): WorkerOptions {
    return {
      connection: this.redisConnection,
      concurrency: config.CONCURRENCY,
      ...(config.RATE_LIMIT && { limiter: config.RATE_LIMIT }),
    };
  }

  private async processTranslationJob(job: Job<JobData>) {
    const { data, id: jobId, attemptsMade } = job;
    const { docId, user, targetLanguage, file } = data;
    const jobKey = `job:${docId}`;
    const startTime = Date.now();
    const signal = this.abortController.signal;

    this.activeJobs.set(jobId!, user.email!);

    try {
      const reconstructedFile = await this.reconstructFile(file);

      if (signal.aborted) throw new Error('Worker shutting down');

      logger.info('Translating document', { jobId });

      await this.updateJobStatus(docId, JobStatus.TRANSLATE);

      // 3. AI Translation & Summarization
      const translatedDocument = await this.geminiService.translateDocument(
        reconstructedFile,
        targetLanguage,
      );

      if (signal.aborted) throw new Error('Worker shutting down');

      logger.info('Summarizing document', { jobId });

      await this.updateJobStatus(docId, JobStatus.SUMMARIZE);

      const summarizedDocument = await this.geminiService.summarizeDocument(
        translatedDocument.translatedText!,
        targetLanguage,
      );

      await this.updateJobStatus(docId, JobStatus.SAVING);

      const documentData = this.buildDocumentData(
        summarizedDocument,
        translatedDocument,
        user.userId.toString(),
        docId,
        targetLanguage,
      );

      if (signal.aborted) throw new Error('Worker shutting down');

      logger.info('Creating Document and Saving to DB', { jobId });

      // 4. Save to DB
      await this.documentService.createDocumentAndUpdatePlanLimit(
        documentData,
        user.plan as PlanType,
      );

      // 5. Cleanup on Success
      await this.updateJobStatus(docId, JobStatus.COMPLETED);
      await this.cleanupTempFile(file.filePath);

      const duration = (Date.now() - startTime) / 1000;
      logger.info(
        `Job successfully processed for Doc: ${docId} | Duration: ${duration}s`,
      );
    } catch (error) {
      await this.handleJobFailure(
        error,
        jobId!,
        docId,
        attemptsMade,
        job.opts.attempts || WORKER_CONFIG.TRANSLATION.MAX_ATTEMPTS,
        file.filePath,
      );

      throw error;
    } finally {
      this.activeJobs.delete(jobId!);
      await this.releaseLock('document-processing', user.email!);
    }
  }

  private async processWelcomeEmailJob(job: Job<WelcomeEmailJobData>) {
    const { userId, email } = job.data;
    const jobId = job.id!;

    this.activeJobs.set(jobId, email);
    try {
      await this.notificationService.sendWelcomeEmail(userId, email);
    } finally {
      this.activeJobs.delete(jobId);
      await this.releaseLock('welcome-email', email);
    }
  }

  /**
   * Build document data object
   */
  private buildDocumentData(
    summarizedDocument: any,
    translatedDocument: any,
    userId: string,
    docId: string,
    targetLanguage: string,
  ): IDocument {
    return {
      title: summarizedDocument.title || '',
      sender: summarizedDocument.sender || '',
      receivedDate: summarizedDocument.receivedDate || new Date(),
      summary: summarizedDocument.summary || '',
      actionPlan: summarizedDocument.actionPlan || [],
      actionPlans: (summarizedDocument.actionPlans || []).map(
        (plan: IActionPlan) => ({
          id: plan.id || uuidv4(),
          title: plan.title || '',
          dueDate: plan.dueDate || new Date(),
          completed: false,
          location: plan.location || '',
        }),
      ),
      userId,
      docId,
      translatedText: translatedDocument.translatedText,
      structuredTranslatedText: translatedDocument.structuredTranslatedText,
      targetLanguage,
      pdfBlobStorage: false,
    };
  }

  /**
   * Handle job failure with appropriate cleanup and logging
   */
  private async handleJobFailure(
    error: any,
    jobId: string,
    docId: string,
    attemptsMade: number,
    maxAttempts: number,
    filePath: string,
  ): Promise<void> {
    const isFinalAttempt = attemptsMade + 1 >= maxAttempts;

    logger.error('Job processing failed', {
      jobId,
      docId,
      attempt: attemptsMade + 1,
      maxAttempts,
      isFinalAttempt,
      error: ErrorSerializer.serialize(error),
      errorCode: error.code || 'UNKNOWN',
    });

    const jobKey = `job:${docId}`;
    await redis.hset(jobKey, {
      status: JobStatus.ERROR,
      error: error.message || 'Unknown error',
    });

    if (isFinalAttempt) {
      await this.cleanupTempFile(filePath);
    }
  }

  /**
   * Clean up temporary file with error handling
   */
  private async cleanupTempFile(filePath: string): Promise<void> {
    try {
      await fs.unlink(filePath);
      logger.debug('Temporary file deleted', { filePath });
    } catch (error) {
      logger.warn('Failed to delete temporary file', {
        filePath,
        error: ErrorSerializer.serialize(error),
      });
    }
  }

  /**
   * Update job status in Redis with error handling
   */
  private async updateJobStatus(
    docId: string,
    status: JobStatus,
  ): Promise<void> {
    const jobKey = `job:${docId}`;

    try {
      await redis.hset(jobKey, 'status', status);
      await redis.expire(jobKey, WORKER_CONFIG.REDIS.JOB_TTL);
    } catch (error) {
      logger.error('Failed to update job status in Redis', {
        docId,
        status,
        error: ErrorSerializer.serialize(error),
      });
      throw new DatabaseError('Failed to update job status in Redis');
    }
  }

  /**
   * Reconstruct file from stored path
   */
  private async reconstructFile(file: {
    filePath: string;
    originalname: string;
    mimetype: string;
  }): Promise<FileMulter> {
    const fileBuffer = await fs.readFile(file.filePath);

    return {
      fieldname: 'file',
      originalname: file.originalname,
      mimetype: file.mimetype,
      buffer: fileBuffer,
      size: fileBuffer.length,
    };
  }

  private setupEventListeners() {
    const workerConfigs = [
      {
        worker: this.translationWorker,
        lockPrefix: 'document-processing',
        name: 'Translation',
        emailField: 'user.email',
      },
      {
        worker: this.welcomeEmailWorker,
        lockPrefix: 'welcome-email',
        name: 'WelcomeEmail',
        emailField: 'email',
      },
    ];

    workerConfigs.forEach(({ worker, lockPrefix, name }) => {
      if (!worker) return;

      this.attachWorkerEvents(worker, lockPrefix, name);
    });
  }

  /**
   * Attach event handlers to a worker
   */
  private attachWorkerEvents(
    worker: Worker<JobData> | Worker<WelcomeEmailJobData>,
    lockPrefix: string,
    name: string,
  ): void {
    worker.on(
      'completed',
      async (job: Job<JobData> | Job<WelcomeEmailJobData>) => {
        const email =
          (job.data as WelcomeEmailJobData).email ||
          (job.data as JobData).user?.email;
        await this.releaseLock(lockPrefix, email!);

        logger.debug(`${name} job completed`, {
          jobId: job.id,
          email,
        });
      },
    );

    worker.on('failed', async (job, error) => {
      logger.error(`${name} job failed`, {
        jobId: job?.id,
        error: error.message,
      });
    });

    worker.on('error', (error) => {
      this.handleWorkerError(error, name);
    });

    worker.on('stalled', (jobId) => {
      logger.warn(`${name} job stalled`, { jobId });
    });
  }

  /**
   * Handle worker-level errors
   */
  private handleWorkerError(error: Error, workerName: string): void {
    const isAuthError =
      error.message.includes('WRONGPASS') || error.message.includes('NOAUTH');

    if (isAuthError) {
      logger.error('Fatal Redis authentication error detected', {
        worker: workerName,
        error: ErrorSerializer.serialize(error),
      });
      process.exit(1);
    }

    logger.error(`${workerName} worker error`, {
      error: ErrorSerializer.serialize(error),
    });
  }

  /**
   * Setup graceful shutdown handlers
   */
  private setupSignalHandlers(): void {
    const signals: NodeJS.Signals[] = ['SIGTERM', 'SIGINT'];

    signals.forEach((signal) => {
      process.on(signal, () => this.gracefulShutdown(signal));
    });

    process.on('uncaughtException', (error) => {
      logger.error('Uncaught exception', {
        error: ErrorSerializer.serialize(error),
      });
      this.gracefulShutdown('UNCAUGHT_EXCEPTION');
    });

    process.on('unhandledRejection', (reason) => {
      logger.error('Unhandled rejection', {
        reason: ErrorSerializer.serialize(reason),
      });
      this.gracefulShutdown('UNHANDLED_REJECTION');
    });
  }

  /**
   * Perform graceful shutdown
   */
  private async gracefulShutdown(signal: string): Promise<void> {
    if (this.isShuttingDown) {
      logger.warn('Shutdown already in progress, forcing exit');
      process.exit(1);
    }

    this.isShuttingDown = true;
    logger.warn(`Received ${signal}, initiating graceful shutdown...`);

    try {
      await this.cleanup();
      logger.info('Graceful shutdown completed');
      process.exit(0);
    } catch (error) {
      logger.error('Error during shutdown', {
        error: ErrorSerializer.serialize(error),
      });
      process.exit(1);
    }
  }

  /**
   * Clean up all resources
   */
  private async cleanup(): Promise<void> {
    if (this.isShuttingDown) return;
    this.isShuttingDown = true;

    logger.warn('Shutdown: Aborting tasks and clearing active locks...');

    // 1. Signal all JS execution to stop
    this.abortController.abort();

    // 2. Close Workers (Hard close: cancels active jobs in BullMQ)
    if (this.translationWorker) await this.translationWorker.close(true);
    if (this.welcomeEmailWorker) await this.welcomeEmailWorker.close(true);

    // 3. FORCE RELEASE ALL TRACKED LOCKS
    if (this.activeJobs.size > 0) {
      logger.info(`Cleaning up ${this.activeJobs.size} active locks...`);
      const releasePromises = [];

      for (const [jobId, email] of this.activeJobs) {
        releasePromises.push(this.releaseLock('document-processing', email));
        releasePromises.push(this.releaseLock('welcome-email', email));
      }

      await Promise.all(releasePromises);
      this.activeJobs.clear();
    }

    // 4. Give Redis/Network a brief moment to finish the DEL commands
    await new Promise((resolve) => setTimeout(resolve, 500));

    await disconnectFromDatabase('Worker').catch(() => {});

    if (redis.status !== 'end') {
      await redis.quit().catch(() => {});
      logger.info('Redis connection closed.');
    }

    logger.info('Graceful shutdown completed. Systems clean.');
    process.exit(0);
  }
}

container.resolve(BackgroundWorker);
