import User from '@/models/user.model';
import Document from '@/models/document.model';
import ChatBotHistory from '@/models/chatbotHistory.model';
import { schedulerLogger as logger } from './logger';
import config from '@/config';
import { ConfidentialClientApplication } from '@azure/msal-node';
import { Client } from '@microsoft/microsoft-graph-client';


export interface PurgeStats {
  total: number;
  purged: number;
  failed: number;
}

export class UserDeleteService {
  private azureConfig = {
    auth: {
      clientId: config.AZURE_CLIENT_ID!,
      clientSecret: config.AZURE_CLIENT_SECRETE!,
      authority: config.AZURE_CLIENT_AUTHORITY,
    },
  };
  async execute(): Promise<PurgeStats> {
    logger.info('[Phase 3] Checking for users disabled > 1 day...');

    const threshold = new Date();
    threshold.setDate(threshold.getDate() - 1);

    const candidates = await User.find({
      status: 'disabled',
      disabledAt: { $lte: threshold },
    })
      .select('userId email')
      .lean();

    const stats: PurgeStats = {
      total: candidates.length,
      purged: 0,
      failed: 0,
    };

    if (candidates.length === 0) return stats;

    const cca = new ConfidentialClientApplication(this.azureConfig);
    const tokenRequest = { scopes: ['https://graph.microsoft.com/.default'] };

    for (const user of candidates) {
      try {
        const authRes = await cca.acquireTokenByClientCredential(tokenRequest);
        const client = Client.init({
          authProvider: (done) => done(null, authRes?.accessToken!),
        });

        // Delete from Entra ID
        await client.api(`/users/${user.userId}`).delete();

        // Verification logic
        const [docCount, histCount] = await Promise.all([
          Document.countDocuments({ userId: user.userId }),
          ChatBotHistory.countDocuments({ userId: user.userId }),
        ]);

        if (docCount === 0 && histCount === 0) {
          await User.deleteOne({ userId: user.userId });
          logger.info(`[DB] User ${user.email} purged from database.`);
          stats.purged++;
        } else {
          // This is a "handled" error - we don't want to crash the whole cron job
          logger.error(
            `[Purge] Orphaned data found for ${user.email}. Cleanup phase likely failed earlier.`,
          );
          stats.failed++;
        }
      } catch (error: any) {
        const status = error?.statusCode ?? 500;
        if (status === 404) {
          await User.deleteOne({ userId: user.userId });
          stats.purged++;
          logger.info(`[DB] User ${user.email} (not in Azure) purged.`);
        } else {
          // If we are here, something specific to this user failed
          logger.error(
            `[Purge] Failed to remove ${user.email}: ${error.message}`,
          );
          stats.failed++;
        }
      }
    }
    return stats;
  }
}
