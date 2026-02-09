import Redis from 'ioredis';
import config from '@/config';
import { logger } from '@/lib/winston';

const redis = new Redis({
  host: config.REDIS_HOST,
  port: config.REDIS_PORT,
  password: config.REDIS_PASSWORD,
  lazyConnect: false,
  
  retryStrategy(times) {
    if (times > 5) return null;
    return Math.min(times * 100, 3000);
  },

  reconnectOnError(err) {
    if (err.message.includes('WRONGPASS')) {
      logger.error('Redis WRONGPASS detected. Stopping server...');
      setTimeout(() => process.exit(1), 500);
      return false;
    }
    return true;
  }
});

// Add this listener for extra safety
redis.on('error', (err) => {
  if (err.message.includes('WRONGPASS')) {
    logger.error('Fatal Redis Error: Invalid Credentials.');
    process.exit(1);
  }
});

export default redis;