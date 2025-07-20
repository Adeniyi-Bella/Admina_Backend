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
  JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET!,
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET!,
  ACCESS_TOKEN_EXPIRY: process.env.ACCESS_TOKEN_EXPIRY as ms.StringValue,
  REFRESH_TOKEN_EXPIRY: process.env.REFRESH_TOKEN_EXPIRY as ms.StringValue,
  AZURE_TENANT_ID: process.env.AZURE_TENANT_ID!,
  AZURE_CLIENT_ID: process.env.AZURE_CLIENT_ID!,
  VISION_KEY: process.env.VISION_KEY!,
  VISION_ENDPOINT: process.env.VISION_ENDPOINT!,
  TRANSLATOR_KEY: process.env.TRANSLATOR_KEY,
  TRANSLATOR_ENDPOINT: process.env.TRANSLATOR_ENDPOINT,
  TRANSLATOR_LOCATION: process.env.TRANSLATOR_LOCATION,
  defaultResLimit: 20,
  defaultResOffset: 0,
};

export default config;
