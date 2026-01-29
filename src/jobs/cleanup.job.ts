import { IChatBotService } from '@/services/chatbot/chatbot.interface';
import { IDocumentService } from '@/services/document/document.interface';
import { IUserService } from '@/services/users/user.interface';
import { container } from 'tsyringe';
import User from '@/models/user.model';
import { logger } from '@/lib/winston';

// @/jobs/cleanup.job.ts
export class CleanupJob {
  async runJanitor() {
    const docService = container.resolve<IDocumentService>('IDocumentService');
    const chatService = container.resolve<IChatBotService>('IChatBotService');

    // Find users marked for deletion
    const pendingUsers = await User.find({
      status: 'deleted',
      cleanUpCompleted: false,
    }).limit(100);

    if (pendingUsers.length === 0) {
      return;
    }

    logger.info(`Janitor starting cleanup for ${pendingUsers.length} users`);

    for (const user of pendingUsers) {
      try {
        // 2. Perform heavy deletions
        // We use Promise.all to run these in parallel for this specific user
        await Promise.all([
          chatService.deleteChatHistoryByUserId(user.userId),
          docService.deleteAllDocuments(user.userId)
        ]);

        // 3. Mark cleanup as completed
        // This ensures the Janitor won't pick this user up again tomorrow
        await User.updateOne(
          { _id: user._id },
          { 
            $set: { 
              cleanUpCompleted: true,
              updatedAt: new Date() 
            } 
          }
        );

        logger.info(`Janitor successfully cleaned data for: ${user.userId}`);
      } catch (error) {
        logger.error(`Janitor failed for user ${user.userId}`, error);
      }
    }
  }
}
