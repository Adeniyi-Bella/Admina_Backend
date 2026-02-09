import config from '@/config';
import { logger } from '@/lib/winston';
import { RedisOptions } from 'ioredis';
import redis from './redis';
import { ErrorSerializer } from '../api_response/error';
import { Queue } from 'bullmq';

/**
 * Redis connection configuration constants
 */
const REDIS_CONFIG = {
  MAX_RETRY_ATTEMPTS: 5,
  MAX_RETRY_DELAY_MS: 3000,
  BASE_RETRY_DELAY_MS: 100,
  AUTH_ERROR_SHUTDOWN_DELAY_MS: 1000,
  DEFAULT_LOCK_TTL: 600,
} as const;

/**
 * Base class for Redis-based handlers with enterprise-grade connection management
 *
 * Features:
 * - Exponential backoff retry strategy
 * - Automatic recovery from transient failures
 * - Immediate shutdown on authentication failures
 * - Comprehensive error logging
 * - Connection health monitoring
 */
export abstract class BaseRedisHandler {
  protected readonly redisConnection: RedisOptions;

  constructor() {
    this.redisConnection = this.buildRedisConnection();
  }

  /**
   * Build Redis connection configuration with production-ready settings
   */
  private buildRedisConnection(): RedisOptions {
    return {
      host: config.REDIS_HOST,
      port: config.REDIS_PORT,
      password: config.REDIS_PASSWORD,

      // Allow unlimited retries in the queue (BullMQ requirement)
      maxRetriesPerRequest: null,

      // Connection pool settings
      lazyConnect: false,
      enableReadyCheck: true,
      enableOfflineQueue: true,

      // Timeouts
      connectTimeout: 10000,
      // commandTimeout: 5000,

      // Keep-alive settings
      keepAlive: 30000,

      // Retry strategy with exponential backoff
      retryStrategy: this.createRetryStrategy(),

      // Reconnection strategy for fatal errors
      reconnectOnError: this.createReconnectStrategy(),
    };
  }

  /**
   * ATOMIC DISTRIBUTED LOCK
   * Uses Redis SET with NX flag to ensure only one process wins.
   */
  protected async acquireLock(
    prefix: string,
    identifier: string,
    ttl: number = 600,
  ): Promise<boolean> {
    try {
      const lockKey = this.getLockKey(prefix, identifier);
      const result = await redis.set(lockKey, 'true', 'EX', ttl, 'NX');
      return result === 'OK';
    } catch (error) {
      logger.error('Failed to acquire Redis lock', {
        prefix,
        identifier,
        error: ErrorSerializer.serialize(error),
      });
      return false;
    }
  }

  /**
   * Centralized key generator to prevent mismatches
   */
  protected getLockKey(prefix: string, identifier: string): string {
    // This ensures we don't get 'lock:lock:user'
    const cleanPrefix = prefix.replace(/^lock:/, '');
    return `lock:${cleanPrefix}:${identifier}`;
  }

  /**
   * RELEASE DISTRIBUTED LOCK
   */
  protected async releaseLock(
    prefix: string,
    identifier: string,
  ): Promise<void> {
    if (redis.status !== 'ready') {
      logger.warn('Lock release skipped: Redis connection is closed', {
        prefix,
        identifier,
      });
      return;
    }

    try {
      const lockKey = this.getLockKey(prefix, identifier);
      const deleted = await redis.del(lockKey);
      if (deleted) {
        logger.info(`Lock released successfully: ${lockKey}`);
      } else {
        logger.warn(
          `Attempted to release lock, but key did not exist: ${lockKey}`,
        );
      }
    } catch (error) {
      logger.warn('Failed to release Redis lock', {
        prefix,
        identifier,
        error: ErrorSerializer.serialize(error),
      });
    }
  }

  /**
   * Worker Availability Check
   * Returns true if at least one worker is listening to the queue
   */
  protected async checkWorkersAvailable(queue: Queue): Promise<boolean> {
    try {
      const workers = await queue.getWorkers();
      return workers.length > 0;
    } catch (error) {
      logger.error('Failed to check worker availability', {
        queue: queue.name,
        error: ErrorSerializer.serialize(error),
      });
      return false;
    }
  }

  /**
   * Creates exponential backoff retry strategy
   *
   * Strategy:
   * - Attempt 1: 100ms
   * - Attempt 2: 200ms
   * - Attempt 3: 300ms
   * - ...
   * - Max: 3000ms
   * - Stops after 5 attempts
   */
  private createRetryStrategy(): (times: number) => number | null {
    return (times: number): number | null => {
      if (times > REDIS_CONFIG.MAX_RETRY_ATTEMPTS) {
        logger.error(
          'Redis connection failed: Maximum retry attempts exceeded',
          {
            attempts: times,
            maxAttempts: REDIS_CONFIG.MAX_RETRY_ATTEMPTS,
          },
        );

        // Return null to stop retrying - this will cause the worker to exit
        return null;
      }

      const delay = Math.min(
        times * REDIS_CONFIG.BASE_RETRY_DELAY_MS,
        REDIS_CONFIG.MAX_RETRY_DELAY_MS,
      );

      logger.warn('Redis connection retry scheduled', {
        attempt: times,
        delayMs: delay,
        maxAttempts: REDIS_CONFIG.MAX_RETRY_ATTEMPTS,
      });

      return delay;
    };
  }

  /**
   * Creates reconnection strategy for handling fatal errors
   *
   * Behavior:
   * - Authentication errors (WRONGPASS, NOAUTH): Shutdown process immediately
   * - Other errors: Attempt reconnection
   */
  private createReconnectStrategy(): (error: Error) => boolean | 1 | 2 {
    return (error: Error): boolean | 1 | 2 => {
      const errorMessage = error.message.toLowerCase();
      const isAuthError = this.isAuthenticationError(errorMessage);

      if (isAuthError) {
        logger.error('FATAL: Redis authentication failed', {
          error: error.message,
          action: 'Shutting down process to prevent infinite retry loop',
        });

        // Schedule process exit to allow current operations to complete
        setTimeout(() => {
          logger.error('Process exiting due to Redis authentication failure');
          process.exit(1);
        }, REDIS_CONFIG.AUTH_ERROR_SHUTDOWN_DELAY_MS);

        // Return false to prevent reconnection attempts
        return false;
      }

      // Check for other non-recoverable errors
      if (this.isNonRecoverableError(errorMessage)) {
        logger.error('Non-recoverable Redis error detected', {
          error: error.message,
        });
        return false;
      }

      // For all other errors, attempt reconnection
      logger.warn('Redis error detected, will attempt reconnection', {
        error: error.message,
      });

      return true;
    };
  }

  /**
   * Check if error is an authentication failure
   */
  private isAuthenticationError(errorMessage: string): boolean {
    const authErrorPatterns = [
      'wrongpass',
      'noauth',
      'noperm',
      'authentication failed',
    ];

    return authErrorPatterns.some((pattern) => errorMessage.includes(pattern));
  }

  /**
   * Check if error is non-recoverable
   */
  private isNonRecoverableError(errorMessage: string): boolean {
    const nonRecoverablePatterns = [
      'readonly',
      'loading',
      'masterdown',
      'protocol error',
    ];

    return nonRecoverablePatterns.some((pattern) =>
      errorMessage.includes(pattern),
    );
  }

  /**
   * Get connection health information (for monitoring)
   */
  protected getConnectionHealth(): {
    host: string;
    port: number;
    hasPassword: boolean;
  } {
    return {
      host: config.REDIS_HOST,
      port: config.REDIS_PORT,
      hasPassword: !!config.REDIS_PASSWORD,
    };
  }
}
