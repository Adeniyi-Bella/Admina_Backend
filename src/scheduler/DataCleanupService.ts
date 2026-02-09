import User from '@/models/user.model';
import Document from '@/models/document.model';
import ChatBotHistory from '@/models/chatbotHistory.model';
import { schedulerLogger as logger } from './logger';

export class DataCleanupService {
  async execute(): Promise<number> {
    logger.info('[Phase 1] Checking for disabled users requiring data cleanup...');
    
    // Find users who are disabled but haven't had their data wiped yet
    const usersToCleanup = await User.find({ 
      status: 'disabled', 
      cleanupCompletedAt: null 
    }).select('userId email').lean();

    if (usersToCleanup.length === 0) {
      logger.info('[Phase 1] No new data cleanup required.');
      return 0;
    }

    const userIds = usersToCleanup.map(u => u.userId);

    // Immediate deletion of associated data
    const [docRes, chatbotHistory] = await Promise.all([
      Document.deleteMany({ userId: { $in: userIds } }),
      ChatBotHistory.deleteMany({ userId: { $in: userIds } })
    ]);

    // Mark cleanup as completed in the User object
    await User.updateMany(
      { userId: { $in: userIds } },
      { $set: { cleanupCompletedAt: new Date() } }
    );

    logger.info(`[Phase 1] Success: Wiped data for ${userIds.length} users. (${docRes.deletedCount} docs, ${chatbotHistory.deletedCount} chats deleted)`);
    return userIds.length;
  }
}