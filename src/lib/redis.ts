/**
 * @copyright 2025 Adeniyi Bella
 * @license Apache-2.0
 */

import Redis from 'ioredis';
import { logger } from './winston';

const redis = new Redis({
  host: '127.0.0.1',
  port: 6379,
});

redis.on('connect', () => logger.info(' Redis connected'));
redis.on('error', (err) => logger.error('Redis error:', err));

export default redis;
