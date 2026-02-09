import { Resend } from 'resend';
import Document from '@/models/document.model';
import User from '@/models/user.model';
import { logger } from '@/lib/winston';
import { ErrorSerializer } from '@/lib/api_response/error';
import { Queue } from 'bullmq';
import { schedulerLogger as cronLogger } from '@/scheduler/logger';
import { BaseRedisHandler } from '../../lib/redis/redis-base.service';
import config from '@/config';
import {
  EMAIL_CONFIG,
  QUEUE_CONFIG,
  REMINDER_CONFIG,
} from '@/constants/notification-service.constant';
import { NotificationStats, ReminderDocument } from '@/types';
import { injectable } from 'tsyringe';

@injectable()
export class NotificationService extends BaseRedisHandler {
  private readonly queue: Queue;
  private readonly resend: Resend;

  constructor() {
    super();
    this.queue = new Queue(QUEUE_CONFIG.NAME, {
      connection: this.redisConnection,
    });
    this.resend = new Resend(config.RESEND_API_KEY);
  }

  /**
   * Send email via Resend API
   */
  private async sendEmail(
    to: string,
    subject: string,
    html: string,
  ): Promise<void> {
    const plainText = this.convertToPlainText(html);

    const { error } = await this.resend.emails.send({
      from: EMAIL_CONFIG.FROM,
      to: [to],
      subject,
      html: this.wrapEmailContent(html),
      text: plainText, // Plain text version required
      headers: {
        'X-Entity-Ref-ID': `${Date.now()}-${to.split('@')[0]}`,
        'List-Unsubscribe': `<${EMAIL_CONFIG.HOME_URL}/unsubscribe>`,
      },
    });

    if (error) {
      throw new Error(error.message);
    }
  }

  /**
   * Convert HTML to plain text
   */
  private convertToPlainText(html: string): string {
    return html
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n\n')
      .replace(/<li>/gi, '• ')
      .replace(/<\/li>/gi, '\n')
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/\s+/g, ' ')
      .replace(/\n\s+/g, '\n')
      .trim();
  }

  /**
   * Wrap email content with branded template
   */
  private wrapEmailContent(content: string): string {
    return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Admina</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f5f5f5;">
        <tr>
          <td align="center" style="padding: 40px 20px;">
            <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width: 600px; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
              
              <!-- Header -->
              <tr>
                <td style="background-color: ${EMAIL_CONFIG.BRAND_COLOR}; padding: 30px 40px; text-align: center;">
                  <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 600; letter-spacing: 0.5px;">${EMAIL_CONFIG.BRAND_NAME}</h1>
                  <p style="margin: 8px 0 0; color: rgba(255,255,255,0.9); font-size: 14px; font-weight: 400;">${EMAIL_CONFIG.TAGLINE}</p>
                </td>
              </tr>
              
              <!-- Content -->
              <tr>
                <td style="padding: 40px; color: #333333; font-size: 16px; line-height: 1.6;">
                  ${content}
                </td>
              </tr>
              
              <!-- Footer -->
              <tr>
                <td style="background-color: #f9f9f9; padding: 30px 40px; border-top: 1px solid #e5e5e5;">
                  <table width="100%" cellpadding="0" cellspacing="0" border="0">
                    <tr>
                      <td style="text-align: center; padding-bottom: 15px;">
                        <p style="margin: 0; font-size: 13px; color: #666666; line-height: 1.5;">
                          © 2025 Admina Inc. All rights reserved.<br>
                          Making government bureaucracy accessible to everyone.
                        </p>
                      </td>
                    </tr>
                    <tr>
                      <td style="text-align: center; padding-bottom: 15px;">
                        <a href="${EMAIL_CONFIG.HOME_URL}" style="color: #007bff; text-decoration: none; font-size: 13px; margin: 0 8px;">Website</a>
                        <span style="color: #999999;">|</span>
                        <a href="${EMAIL_CONFIG.HOME_URL}/privacy" style="color: #007bff; text-decoration: none; font-size: 13px; margin: 0 8px;">Privacy Policy</a>
                        <span style="color: #999999;">|</span>
                        <a href="${EMAIL_CONFIG.HOME_URL}/unsubscribe" style="color: #007bff; text-decoration: none; font-size: 13px; margin: 0 8px;">Unsubscribe</a>
                      </td>
                    </tr>
                    <tr>
                      <td style="text-align: center;">
                        <p style="margin: 0; font-size: 12px; color: #999999; line-height: 1.5;">
                          Admina Inc.<br>
                          [Your Business Address]<br>
                          [City, State, Postal Code]
                        </p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              
            </table>
            
            <!-- Spam compliance text (invisible but helps) -->
            <div style="text-align: center; margin-top: 20px; font-size: 11px; color: #999999;">
              You're receiving this email because you created an account at admina-app.com
            </div>
            
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;
  }

  /**
   * Send welcome email to newly registered user
   */
  async sendWelcomeEmail(userId: string, email: string): Promise<void> {
    try {
      const html = this.buildWelcomeEmailContent();

      await this.sendEmail(
        email,
        `A personal welcome to Admina, ${email}`,
        html,
      );

      await this.updateWelcomeEmailStatus(userId, 'sent');

      logger.info('Welcome email sent successfully', { userId, email });
    } catch (error: any) {
      await this.handleWelcomeEmailFailure(userId, email, error);
      throw new Error(`Email delivery failed: ${error.message}`);
    }
  }

  /**
   * Build welcome email HTML content
   */
  private buildWelcomeEmailContent(): string {
    return `
    <p style="margin: 0 0 16px;">Hi there,</p>
    
    <p style="margin: 0 0 16px;">Welcome to Admina! I'm Adeniyi Bella, the founder.</p>
    
    <p style="margin: 0 0 16px;">I built Admina because I know firsthand how overwhelming official letters can be when you're navigating a new country. The language barriers, confusing bureaucracy, and fear of missing important deadlines, I've been there.</p>
    
    <p style="margin: 0 0 16px;">Here's what Admina can help you with:</p>
    
    <ul style="margin: 0 0 24px; padding-left: 20px;">
      <li style="margin-bottom: 8px;">Translate documents into your native language</li>
      <li style="margin-bottom: 8px;">Get clear summaries of complex letters</li>
      <li style="margin-bottom: 8px;">Automatic deadline extraction and reminders</li>
      <li style="margin-bottom: 8px;">AI assistant to answer your questions</li>
    </ul>
    
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 32px 0;">
      <tr>
        <td align="center">
          <a href="${EMAIL_CONFIG.HOME_URL}/login" style="display: inline-block; background-color: #000000; color: #ffffff; padding: 14px 32px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px;">
            Get Started
          </a>
        </td>
      </tr>
    </table>
    
    <p style="margin: 0 0 16px;">Have questions? Just reply to this email. I read every message.</p>
    
    <p style="margin: 24px 0 0;">
      Best regards,<br>
      <strong>Adeniyi Bella</strong><br>
      <span style="color: #666666;">Founder & CEO, Admina</span>
    </p>
  `;
  }

  /**
   * Update welcome email status in database
   */
  private async updateWelcomeEmailStatus(
    userId: string,
    status: 'sent' | 'failed',
  ): Promise<void> {
    const update =
      status === 'sent'
        ? {
            welcomeEmailStatus: 'sent',
            welcomeEmailSentAt: new Date(),
          }
        : {
            $set: { welcomeEmailStatus: 'failed' },
            $inc: { welcomeEmailTries: 1 },
          };

    await User.updateOne(
      { userId },
      status === 'sent' ? { $set: update } : update,
    );
  }

  /**
   * Handle welcome email failure
   */
  private async handleWelcomeEmailFailure(
    userId: string,
    email: string,
    error: any,
  ): Promise<void> {
    await this.updateWelcomeEmailStatus(userId, 'failed');

    logger.error('Failed to send welcome email', {
      userId,
      email,
      error: ErrorSerializer.serialize(error),
    });
  }

  /**
   * Queue welcome email for asynchronous processing
   * Non-blocking operation - will not crash request if queue is down
   */
  async queueWelcomeEmail(userId: string, email: string): Promise<void> {
    try {
      const hasWorkers = await this.checkWorkersAvailable(this.queue);
      if (!hasWorkers) {
        logger.warn('No workers available for welcome email queue', { email });
        return;
      }

      const locked = await this.acquireLock('welcome-email', email);
      if (!locked) {
        logger.debug('Welcome email already queued', { email });
        return;
      }

      await this.queue.add(
        'send-welcome',
        { userId, email },
        {
          attempts: QUEUE_CONFIG.MAX_ATTEMPTS,
          backoff: {
            type: 'exponential',
            delay: QUEUE_CONFIG.BACKOFF_DELAY,
          },
          removeOnComplete: true,
        },
      );

      logger.info('Welcome email queued successfully', { userId, email });
    } catch (error) {
      logger.error('Failed to queue welcome email', {
        userId,
        email,
        error: ErrorSerializer.serialize(error),
      });
    }
  }

  /**
   * Process daily action plan deadline reminders
   */
  async processDailyReminders(isRetry = false): Promise<NotificationStats> {
    cronLogger.info('Starting daily reminder processing', { isRetry });

    const stats: NotificationStats = { total: 0, success: 0, failed: 0 };

    try {
      const activeUserIds = await this.getActiveUserIds();
      if (activeUserIds.length === 0) {
        cronLogger.info('No active users found');
        return stats;
      }

      if (!isRetry) {
        await this.resetDailyEmailTries(activeUserIds);
      }

      const reminders = await this.fetchPendingReminders(activeUserIds);
      stats.total = reminders.length;

      if (stats.total === 0) {
        cronLogger.info('No pending reminders found');
        return stats;
      }

      await this.processReminders(reminders, stats);

      if (this.shouldRetry(stats, isRetry)) {
        cronLogger.warn('Low success rate detected, scheduling retry', {
          stats,
        });
        await this.delay(REMINDER_CONFIG.RETRY_DELAY_MS);
        return this.processDailyReminders(true);
      }

      cronLogger.info('Daily reminder processing completed', { stats });
      return stats;
    } catch (error) {
      cronLogger.error('Error during daily reminder processing', {
        error: ErrorSerializer.serialize(error),
      });
      throw error;
    }
  }

  /**
   * Send reminder email for action plan
   */
  private async sendReminderEmail(reminder: ReminderDocument): Promise<void> {
    const daysLeft = this.calculateDaysLeft(reminder.actionPlans?.dueDate!);
    const urgencyIndicator =
      daysLeft === 0 ? 'Urgent!' : `${daysLeft} days left`;

    const html = this.buildReminderEmailContent(
      reminder.user.username,
      reminder.actionPlans.title!,
      daysLeft,
      reminder.docId,
    );

    await this.sendEmail(
      reminder.user.email,
      `Reminder: ${urgencyIndicator} - ${reminder.actionPlans.title}`,
      html,
    );
  }

  /**
   * Build reminder email HTML content
   */
  private buildReminderEmailContent(
    username: string,
    taskTitle: string,
    daysLeft: number,
    docId: string,
  ): string {
    const daysLeftText = this.formatDaysLeft(daysLeft);
    const urgencyIndicator =
      daysLeft === 0 ? 'Urgent!' : `${daysLeft} days left`;

    return `
      <h2 style="color: #000;">Deadline Reminder</h2>
      <p>Hi ${username},</p>
      
      <p>This is a friendly reminder that you ${daysLeftText} to complete the task 
      <strong style="color: #ff4d4d;">"${taskTitle}"</strong>.</p>

      <p>Login to our <a href="${EMAIL_CONFIG.HOME_URL}" style="color: #000; font-weight: bold; text-decoration: underline;">admina-app.com</a> website to get more information about the task, view the original document, or chat with our assistant for guidance.</p>
      
      <div style="text-align: center; margin: 30px 0;">
        <a href="${EMAIL_CONFIG.HOME_URL}/dashboard/document/${docId}" 
           style="background-color: #000; color: #fff; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">
           View Task Details
        </a>
      </div>

      <p>Missing deadlines for official letters can be costly. We are here to help you stay ahead!</p>
      
      <p>If you have any questions, feel free to reply to this email.</p>

      <p>Best regards,<br>
      <strong>Adeniyi Bella</strong><br>
      CEO, Admina</p>
    `;
  }

  /**
   * Format days left text
   */
  private formatDaysLeft(daysLeft: number): string {
    if (daysLeft === 0) return 'is due <strong>today</strong>';
    if (daysLeft === 1) return 'have <strong>only 1 day</strong> left';
    return `have <strong>${daysLeft} more days</strong> left`;
  }

  /**
   * Calculate days remaining until due date
   */
  private calculateDaysLeft(dueDate: Date): number {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const due = new Date(dueDate);
    due.setHours(0, 0, 0, 0);

    const diffInMs = due.getTime() - today.getTime();
    return Math.ceil(diffInMs / (1000 * 60 * 60 * 24));
  }

  /**
   * Update reminder status in database
   */
  private async updateReminderStatus(
    reminder: ReminderDocument,
    status: 'sent' | 'failed',
  ): Promise<void> {
    const update =
      status === 'sent'
        ? {
            [`actionPlans.${reminder.planIndex}.emailStatus`]: 'sent',
            [`actionPlans.${reminder.planIndex}.lastEmailSentAt`]: new Date(),
            [`actionPlans.${reminder.planIndex}.emailTries`]: 0,
          }
        : {
            $set: {
              [`actionPlans.${reminder.planIndex}.emailStatus`]: 'failed',
            },
            $inc: {
              [`actionPlans.${reminder.planIndex}.emailTries`]: 1,
            },
          };

    await Document.updateOne(
      { userId: reminder.userId },
      status === 'sent' ? { $set: update } : update,
    );
  }

  /**
   * Process batch of reminders
   */
  private async processReminders(
    reminders: ReminderDocument[],
    stats: NotificationStats,
  ): Promise<void> {
    for (const reminder of reminders) {
      try {
        await this.sendReminderEmail(reminder);
        await this.updateReminderStatus(reminder, 'sent');
        stats.success++;
      } catch (error) {
        await this.updateReminderStatus(reminder, 'failed');
        stats.failed++;

        cronLogger.error('Failed to send reminder email', {
          userId: reminder.user.userId,
          email: reminder.user.email,
          taskTitle: reminder.actionPlans.title,
          error: ErrorSerializer.serialize(error),
        });
      }
    }
  }

  /**
   * Get all active user IDs
   */
  private async getActiveUserIds(): Promise<string[]> {
    const users = await User.find({ status: 'active' }).select('userId').lean();

    return users.map((u) => u.userId);
  }

  /**
   * Reset email tries for the day
   */
  private async resetDailyEmailTries(activeUserIds: string[]): Promise<void> {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    await Document.updateMany(
      {
        userId: { $in: activeUserIds },
        'actionPlans.emailNotification': true,
        $or: [
          { 'actionPlans.lastEmailSentAt': { $lt: startOfToday } },
          { 'actionPlans.lastEmailSentAt': { $exists: false } },
        ],
      },
      { $set: { 'actionPlans.$[].emailTries': 0 } },
    );
  }

  /**
   * Fetch pending reminders from database
   */
  private async fetchPendingReminders(
    activeUserIds: string[],
  ): Promise<ReminderDocument[]> {
    const now = new Date();
    const limit = new Date();
    limit.setDate(now.getDate() + REMINDER_CONFIG.DAYS_AHEAD);

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    return Document.aggregate<ReminderDocument>([
      {
        $match: {
          userId: { $in: activeUserIds },
          'actionPlans.emailNotification': true,
          'actionPlans.completed': false,
        },
      },
      { $unwind: { path: '$actionPlans', includeArrayIndex: 'planIndex' } },
      {
        $match: {
          'actionPlans.dueDate': { $gt: now, $lte: limit },
          'actionPlans.emailTries': { $lt: REMINDER_CONFIG.MAX_EMAIL_TRIES },
          $or: [
            { 'actionPlans.lastEmailSentAt': { $lt: startOfToday } },
            { 'actionPlans.lastEmailSentAt': { $exists: false } },
            { 'actionPlans.lastEmailSentAt': null },
          ],
        },
      },
      {
        $lookup: {
          from: 'users',
          localField: 'userId',
          foreignField: 'userId',
          as: 'user',
        },
      },
      { $unwind: '$user' },
      { $match: { 'user.status': 'active' } },
    ]);
  }

  /**
   * Determine if retry is needed based on success rate
   */
  private shouldRetry(stats: NotificationStats, isRetry: boolean): boolean {
    if (isRetry || stats.total === 0) return false;

    const successRate = stats.success / stats.total;
    return successRate < REMINDER_CONFIG.SUCCESS_THRESHOLD;
  }

  /**
   * Delay execution
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Catch up on failed welcome emails
   */
  async catchUpFailedWelcomeEmails(): Promise<void> {
    cronLogger.info('Starting welcome email catch-up');

    try {
      const users = await User.find({
        status: 'active',
        welcomeEmailStatus: { $ne: 'sent' },
        welcomeEmailTries: { $lt: QUEUE_CONFIG.MAX_WELCOME_EMAIL_TRIES },
      })
        .limit(QUEUE_CONFIG.BATCH_LIMIT)
        .lean();

      if (users.length === 0) {
        cronLogger.info('No failed welcome emails to catch up');
        return;
      }

      let successCount = 0;
      let failCount = 0;

      for (const user of users) {
        try {
          await this.sendWelcomeEmail(user.userId, user.email);
          successCount++;
        } catch (error) {
          failCount++;
          cronLogger.error('Failed to send catch-up welcome email', {
            userId: user.userId,
            email: user.email,
            error: ErrorSerializer.serialize(error),
          });
        }
      }

      cronLogger.info('Welcome email catch-up completed', {
        total: users.length,
        success: successCount,
        failed: failCount,
      });
    } catch (error) {
      cronLogger.error('Error during welcome email catch-up', {
        error: ErrorSerializer.serialize(error),
      });
      throw error;
    }
  }
}