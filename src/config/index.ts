/**
 * @copyright 2025 Adeniyi Bella
 * @license Apache-2.0
 */

/**
 * Node modules
 */
import dotenv from 'dotenv';

/**
 * Types
 */
import type ms from 'ms';

dotenv.config();

const config = {
  PORT: process.env.PORT || 3000,
  NODE_ENV: process.env.NODE_ENV,
  MONGO_URI: process.env.MONGO_URI,
  LOG_LEVEL: process.env.LOG_LEVEL || 'info',
  AZURE_TENANT_ID: process.env.AZURE_TENANT_ID!,
  AZURE_CLIENT_ID: process.env.AZURE_CLIENT_ID!,
  OCR_TEXT_EXTRACTION_KEY: process.env.OCR_TEXT_EXTRACTION_KEY!,
  OCR_TEXT_EXTRACTION_ENDPOINT: process.env.OCR_TEXT_EXTRACTION_ENDPOINT!,
  FREE_PLAN_TRANSLATE_REGION: process.env.FREE_PLAN_TRANSLATE_REGION!,
  FREE_PLAN_TRANSLATE_KEY: process.env.FREE_PLAN_TRANSLATE_KEY!,
  FREE_PLAN_TRANSLATE_ENDPOINT: process.env.FREE_PLAN_TRANSLATE_ENDPOINT!,
  OPENAI_API_KEY: process.env.OPENAI_API_KEY!,
  defaultResLimit: 20,
  defaultResOffset: 0,
  K6_API_TEST_TOKEN: process.env.K6_API_TEST_TOKEN,
  AZURE_STORAGE_ACCOUNT_CONNECTION_STRING: process.env.AZURE_STORAGE_ACCOUNT_CONNECTION_STRING!,
  AZURE_STORAGE_ACCOUNT_NAME: process.env.AZURE_STORAGE_ACCOUNT_NAME!,
  AZURE_STORAGE_ACCOUNT_KEY: process.env.AZURE_STORAGE_ACCOUNT_KEY!,
  PREMIUM_PLAN_TRANSLATE_KEY: process.env.PREMIUM_PLAN_TRANSLATE_KEY!,
  PREMIUM_PLAN_TRANSLATE_ENDPOINT: process.env.PREMIUM_PLAN_TRANSLATE_ENDPOINT!,
};

export default config;
