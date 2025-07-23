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
  VISION_KEY: process.env.VISION_KEY!,
  VISION_ENDPOINT: process.env.VISION_ENDPOINT!,
  TRANSLATOR_KEY: process.env.TRANSLATOR_KEY,
  TRANSLATOR_ENDPOINT: process.env.TRANSLATOR_ENDPOINT,
  TRANSLATOR_LOCATION: process.env.TRANSLATOR_LOCATION,
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  defaultResLimit: 20,
  defaultResOffset: 0,
  K6_API_TEST_TOKEN: process.env.K6_API_TEST_TOKEN
};

export default config;
