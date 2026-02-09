export const WORKER_CONFIG = {
  TRANSLATION: {
    QUEUE_NAME: 'translation-queue',
    CONCURRENCY: 5,
    RATE_LIMIT: { max: 50, duration: 10000 },
    MAX_ATTEMPTS: 3,
  },
  WELCOME_EMAIL: {
    QUEUE_NAME: 'welcome-email-queue',
    CONCURRENCY: 2,
    MAX_ATTEMPTS: 3,
  },
  REDIS: {
    JOB_TTL: 1800, // 30 minutes
  },
} as const;