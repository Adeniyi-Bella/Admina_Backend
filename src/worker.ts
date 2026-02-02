import 'reflect-metadata';
import './di/container';
import '@/models/user.model';
import { Worker, Job } from 'bullmq';
import { container } from 'tsyringe';
import redis from '@/lib/redis';
import { logger, logtail } from '@/lib/winston';
import { IGeminiAIService } from '@/services/ai-models/gemini-ai/geminiai.interface';
import { IDocumentService } from '@/services/document/document.interface';
import { IActionPlan, IDocument } from '@/models/document.model';
import { v4 as uuidv4 } from 'uuid';
import { FileMulter, JobData } from './types';
import { connectToDatabase, disconnectFromDatabase } from '@/lib/mongoose';
import { DatabaseError, ErrorSerializer } from './lib/api_response/error';
import fs from 'fs/promises';
import { PlanType } from '@/models/user.model';

class TranslationWorker {
  private readonly queueName = 'translation-queue';
  private readonly concurrency = 5;
  private readonly connectionOptions = {
    host: '127.0.0.1',
    port: 6379,
  };
  private worker: Worker | undefined;

  constructor() {
    this.init();
    this.setupSignalHandlers();
  }

  private async init() {
    try {
      // 1. CONNECT TO MONGODB (Using shared function with context)
      await connectToDatabase('Worker');

      // 2. Start BullMQ Worker
      this.worker = new Worker(this.queueName, this.processJob.bind(this), {
        connection: this.connectionOptions,
        concurrency: this.concurrency,
        limiter: {
          max: 50,
          duration: 10000,
        },
      });

      this.setupListeners();
      logger.info(
        `Worker started on queue "${this.queueName}" with concurrency: ${this.concurrency}`,
      );
    } catch (error) {
      logger.error('Failed to start worker:', {
        error: ErrorSerializer.serialize(error),
      });
      process.exit(1);
    }
  }

  private async processJob(job: Job<JobData>) {
    const { data, id: jobId, attemptsMade } = job;
    const { docId, user, targetLanguage, file } = data;
    const jobKey = `job:${docId}`;
    const startTime = Date.now();

    logger.info(
      `[Job Start] ID: ${jobId} | Doc: ${docId} | Attempt: ${attemptsMade + 1}`,
      {
        user: user.email,
        attempt: attemptsMade + 1,
      },
    );

    try {
      const geminiService =
        container.resolve<IGeminiAIService>('IGeminiAIService');
      const documentService =
        container.resolve<IDocumentService>('IDocumentService');

      // 1. Read the file
      const fileBuffer = await fs.readFile(file.filePath);
      const reconstructedFile: FileMulter = {
        fieldname: 'file',
        originalname: file.originalname,
        mimetype: file.mimetype,
        buffer: fileBuffer,
        size: fileBuffer.length,
      };

      logger.info(`[Job Progress] Doc: ${docId} -> Translating`, { jobId });

      // 2. Track Progress in Redis
      try {
        await redis.hset(jobKey, 'status', 'translate');
        await redis.expire(jobKey, 1800);
      } catch (e) {
        throw new DatabaseError('Failed to initialize job status in Redis');
      }

      // 3. AI Translation & Summarization
      const translatedDocument = await geminiService.translateDocument(
        reconstructedFile,
        targetLanguage,
      );

      logger.info(`[Job Progress] Doc: ${docId} -> Summarizing`, { jobId });

      await redis.hset(jobKey, 'status', 'summarize');
      const summarizedTextDocument = await geminiService.summarizeDocument(
        translatedDocument.translatedText!,
        targetLanguage,
      );
      await redis.hset(jobKey, 'status', 'saving');

      const documentData: IDocument = {
        title: summarizedTextDocument.title || '',
        sender: summarizedTextDocument.sender || '',
        receivedDate: summarizedTextDocument.receivedDate || new Date(),
        summary: summarizedTextDocument.summary || '',
        actionPlan: summarizedTextDocument.actionPlan || [],
        actionPlans: (summarizedTextDocument.actionPlans || []).map(
          (plan: IActionPlan) => ({
            id: plan.id || uuidv4(),
            title: plan.title || '',
            dueDate: plan.dueDate || new Date(),
            completed: false,
            location: plan.location || '',
          }),
        ),
        userId: user.userId.toString(),
        docId,
        translatedText: translatedDocument.translatedText,
        structuredTranslatedText: translatedDocument.structuredTranslatedText,
        targetLanguage: targetLanguage,
        pdfBlobStorage: false,
      };

      logger.info(
        `[Job Progress] Doc: ${docId} -> Creating Document and Saving to DB`,
        { jobId },
      );

      // 4. Save to DB
      await documentService.createDocumentAndUpdatePlanLimit(
        documentData,
        user.plan as PlanType,
      );

            // 5. Cleanup on Success
      await redis.hset(jobKey, 'status', 'completed');
      await fs
        .unlink(file.filePath)
        .catch((err) => logger.error('Failed to delete temp file', err));

         const duration = (Date.now() - startTime) / 1000;
      logger.info(
        `[Job Success] ID: ${jobId} | Doc: ${docId} | Duration: ${duration}s`,
      );

    } catch (error: any) {
      const isFinalAttempt = attemptsMade + 1 >= (job.opts.attempts || 1);

      logger.error(
        `[Job Failed] ID: ${jobId} | Doc: ${docId} | Attempt: ${attemptsMade + 1}`,
        {
          error: ErrorSerializer.serialize(error),
          isFinalAttempt,
          code: error.code || 'UNKNOWN',
        },
      );
      await redis.hset(jobKey, {
        status: 'error',
        error: error.message,
      });
      if (job.attemptsMade + 1 >= (job.opts.attempts || 1)) {
        await fs
          .unlink(file.filePath)
          .catch((err) => logger.error('Failed to delete temp file', err));
      }

      throw error;
    }
  }

  private setupListeners() {
    if (!this.worker) return;

    this.worker.on('completed', async (job) => {
      const email = job.data.user.email;
      await redis.del(`lock:user:${email}`);
      logger.info(`Lock released for user: ${email} in worker`);
    });

    this.worker.on('failed', async (job, err) => {
      logger.error(`BullMQ Event: Job ${job?.id} failed`, {
        error: ErrorSerializer.serialize(err),
      });
      if (job && job.attemptsMade >= job.opts.attempts!) {
        await redis.del(`lock:user:${job.data.user.email}`);
        logger.warn(`Job ${job.id} permanently failed. Lock released.`);
      }
    });

    this.worker.on('error', (err) => {
      logger.error('Worker connection error:', {
        error: ErrorSerializer.serialize(err),
      });
    });
  }

  private setupSignalHandlers() {
    const shutdown = async (signal: string) => {
      logger.warn(`Worker received ${signal}, shutting down...`);

      try {
        if (this.worker) {
          await this.worker.close();
          logger.info('BullMQ Worker closed.');
        }

        // Use shared disconnect function with 'Worker' context
        await disconnectFromDatabase('Worker');

        if (redis.status === 'ready') {
          await redis.quit();
          logger.info('Redis disconnected.');
        }

        await logtail.flush();
        logger.info('Worker shutdown complete.');
        process.exit(0);
      } catch (err) {
        logger.error('Error during worker shutdown', {
          error: ErrorSerializer.serialize(err),
        });
        process.exit(1);
      }
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  }
}

new TranslationWorker();
