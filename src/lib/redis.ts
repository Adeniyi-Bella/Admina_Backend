/**
 * @copyright 2025 Adeniyi Bella
 * @license Apache-2.0
 */

import Redis from 'ioredis';
import { logger } from './winston';
import { ErrorSerializer } from './api_response/error';

const redis = new Redis({
  host: '127.0.0.1',
  port: 6379,
});

redis.on('connect', () => logger.info(' Redis connected'));
redis.on('error', (error) =>
  logger.error('Redis error:', { error: ErrorSerializer.serialize(error) }),
);

export default redis;
