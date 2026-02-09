/**
 * @copyright 2025 Adeniyi Bella
 * @license Apache-2.0
 */

/**
 * Node modules
 */
import dotenv from 'dotenv';

dotenv.config();

const config = {
  PORT: process.env.PORT || 8080,
  WHITELIST_ORIGINS: process.env.WHITELIST_ORIGINS!,
  NODE_ENV: process.env.NODE_ENV,
  MONGO_URI: process.env.MONGO_URI,
  LOG_LEVEL: process.env.LOG_LEVEL || 'info',
  AZURE_TENANT_ID: process.env.AZURE_TENANT_ID!,
  AZURE_CLIENT_ID: process.env.AZURE_CLIENT_ID!,
  HONEYCOMB_API_KEY: process.env.HONEYCOMB_API_KEY!,
  RESEND_API_KEY: process.env.RESEND_API_KEY!,
  REDIS_HOST: process.env.REDIS_HOST!,
  REDIS_PORT: parseInt(process.env.REDIS_PORT!),
  REDIS_PASSWORD: process.env.REDIS_PASSWORD!,

  ADMINA_API_CLIENT_ID: process.env.ADMINA_API_CLIENT_ID!,
  defaultResLimit: 20,
  defaultResOffset: 0,
  AZURE_CLIENT_SECRETE: process.env.AZURE_CLIENT_SECRETE,
  AZURE_CLIENT_AUTHORITY: process.env.AZURE_CLIENT_AUTHORITY,
  LOGTAIL_SOURCE_TOKEN: process.env.LOGTAIL_SOURCE_TOKEN!,
  LOG_TAIL_INGESTING_HOST: process.env.LOG_TAIL_INGESTING_HOST!,
  GEMINI_API_KEY: process.env.GEMINI_API_KEY!,
};

export default config;
