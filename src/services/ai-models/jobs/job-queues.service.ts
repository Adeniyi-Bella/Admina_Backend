import redis from '@/lib/redis';
import { container } from 'tsyringe';
import { IGeminiAIService } from '../gemini-ai/geminiai.interface';
import { IDocumentService } from '@/services/document/document.interface';
import { IUserService, UserDTO } from '@/services/users/user.interface';
import { IActionPlan, IDocument } from '@/models/document.model';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '@/lib/winston';

interface JobData {
  file: Express.Multer.File;
  targetLanguage: string;
  user: UserDTO;
}

export class TranslateQueueService {
  private geminiService: IGeminiAIService;
  private documentService: IDocumentService;
  private userService: IUserService;
  private concurrency = 5; // max active jobs
  private activeCount = 0;
  private queue: Array<{ docId: string; data: JobData }> = [];

  private static processingUsers = new Set<string>();

  constructor() {
    this.geminiService =
      container.resolve<IGeminiAIService>('IGeminiAIService');
    this.documentService =
      container.resolve<IDocumentService>('IDocumentService');
    this.userService = container.resolve<IUserService>('IUserService');
  }

  public isUserProcessing(email: string): boolean {
    return TranslateQueueService.processingUsers.has(email);
  }

  public addUserToProcessing(email: string): void {
    TranslateQueueService.processingUsers.add(email);
  }

  public removeUserFromProcessing(email: string): void {
    TranslateQueueService.processingUsers.delete(email);
  }

  /**
   * Enqueue a new translation job.
   * Immediately writes docId to Redis to guarantee safe controller reads.
   */
  public async enqueueTranslationJob(docId: string, data: JobData) {
    const jobKey = `job:${docId}`;

    // Ensure docId is always in Redis with initial status 'queued'
    await redis.hmset(jobKey, { docId, status: 'queued' });
    await redis.expire(jobKey, 60 * 60); // 1 hour expiration

    this.queue.push({ docId, data });
    this.processQueue();
  }

  /**
   * Process the queue respecting concurrency limit
   */
  private async processQueue() {
    while (this.activeCount < this.concurrency && this.queue.length > 0) {
      const { docId, data } = this.queue.shift()!;
      this.activeCount++;
      this.runJob(docId, data)
        .catch((err) => console.error(`Job ${docId} encountered error`, err))
        .finally(() => {
          this.activeCount--;
          this.processQueue();
        });
    }
  }

  /**
   * Run the job: translate document, save to DB, update status in Redis
   */
  private async runJob(docId: string, data: JobData) {
    const jobKey = `job:${docId}`;
    await redis.hset(jobKey, 'status', 'translate');

    try {
      const translatedDocument = await this.geminiService.translateDocument(
        data.file,
        data.targetLanguage,
      );

      await redis.hset(jobKey, 'status', 'summarize');

      const summarizedTextDocument = await this.geminiService.summarizeDocument(
        translatedDocument.translatedText!,
        data.targetLanguage!,
      );

      // Save translated document to DB
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
        userId: data.user.userId.toString(),
        docId,
        translatedText: translatedDocument.translatedText,
        structuredTranslatedText: translatedDocument.structuredTranslatedText,
        targetLanguage: data.targetLanguage,
        pdfBlobStorage: false,
      };

      await this.documentService.createDocumentByUserId(documentData);

      let isUpdatedLengthOfDoc;
      // Update lengthOfDocs
      if (data.user.plan === 'free') {
        isUpdatedLengthOfDoc = await this.userService.updateUser(
          data.user.userId,
          'lengthOfDocs.free.current',
          true,
          undefined,
        );
      } else if (data.user.plan === 'standard') {
        isUpdatedLengthOfDoc = await this.userService.updateUser(
          data.user.userId,
          'lengthOfDocs.standard.current',
          true,
          undefined,
        );
      }

      if (!isUpdatedLengthOfDoc) {
        throw new Error('User plan could not be updated');
      }

      await redis.hset(jobKey, 'status', 'completed');
    } catch (err: any) {
      logger.error('Error during document processing', {
        error: err,
      });
      await redis.hmset(jobKey, {
        status: 'error',
        error: err.message ?? 'Unknown error',
      });
    } finally {
      // Always remove user from processing set
      this.removeUserFromProcessing(data.user.email!);
    }
  }

  /**
   * Return only docId and status to the controller
   */
  public async getJobStatus(docId: string) {
    const jobKey = `job:${docId}`;
    const job = await redis.hgetall(jobKey);

    if (!job || Object.keys(job).length === 0) return null;

    return {
      docId: job.docId,
      status: job.status,
      error: job.error,
    };
  }
}
