export const EMAIL_CONFIG = {
  FROM: 'Admina Support Team <support@admina-app.com>',
  BRAND_NAME: 'ADMINA',
  TAGLINE: 'Letter In. Clarity Out.',
  HOME_URL: 'https://www.admina-app.com',
  SUPPORT_EMAIL: 'support@admina-app.com',
  BRAND_COLOR: '#e27d60',
} as const;

export const QUEUE_CONFIG = {
  NAME: 'welcome-email-queue',
  LOCK_TTL: 600, // 10 minutes
  MAX_ATTEMPTS: 3,
  BACKOFF_DELAY: 10000,
  MAX_WELCOME_EMAIL_TRIES: 5,
  BATCH_LIMIT: 50,
} as const;

export const REMINDER_CONFIG = {
  DAYS_AHEAD: 3,
  MAX_EMAIL_TRIES: 3,
  SUCCESS_THRESHOLD: 0.8,
  RETRY_DELAY_MS: 60000,
} as const;