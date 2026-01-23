import redis from '@/lib/redis';
import { logger } from '@/lib/winston';

/**
 * Implements:
 * - Cache-Aside with Invalidation (Delete on write)
 * - Request Coalescing (Thundering Herd Prevention)
 * - Jitter (Randomized TTL)
 * - Tag-Based Invalidation
 * - Circuit Breaker Pattern
 */
export class RedisCacheService {
  private pendingRequests: Map<string, Promise<any>> = new Map();
  private circuitBreakerOpen = false;
  private readonly BASE_TTL = 3600; // 1 hour
  private readonly MAX_JITTER = 300; // 5 minutes

  /**
   * Get with Request Coalescing
   * Prevents thundering herd by ensuring only one DB fetch per key
   */
  async get<T>(key: string): Promise<T | null> {
    if (this.circuitBreakerOpen) {
      logger.warn('Redis circuit breaker open, skipping cache');
      return null;
    }

    try {
      const data = await redis.get(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      logger.error('Redis get error', { key, error });
      this.openCircuitBreaker();
      return null;
    }
  }

  /**
   * Get from Hash (for structured data like User fields)
   */
  async hgetall<T>(key: string): Promise<T | null> {
    if (this.circuitBreakerOpen) return null;

    try {
      const data = await redis.hgetall(key);
      if (!data || Object.keys(data).length === 0) return null;

      // Parse JSON fields if needed
      return this.parseHashData(data) as T;
    } catch (error) {
      logger.error('Redis hgetall error', { key, error });
      this.openCircuitBreaker();
      return null;
    }
  }

  /**
   * Set with Jitter (prevents mass expiration)
   */
  async set(key: string, value: any, ttl?: number): Promise<boolean> {
    if (this.circuitBreakerOpen) return false;

    try {
      const ttlWithJitter = this.getTTLWithJitter(ttl);
      await redis.set(key, JSON.stringify(value), 'EX', ttlWithJitter);
      return true;
    } catch (error) {
      logger.error('Redis set error', { key, error });
      this.openCircuitBreaker();
      return false;
    }
  }

  /**
   * Set Hash (for structured data)
   */
  async hset(key: string, field: string, value: any): Promise<boolean> {
    if (this.circuitBreakerOpen) return false;

    try {
      const serialized = typeof value === 'object' ? JSON.stringify(value) : value;
      await redis.hset(key, field, serialized);
      return true;
    } catch (error) {
      logger.error('Redis hset error', { key, field, error });
      this.openCircuitBreaker();
      return false;
    }
  }

  /**
   * Set entire Hash with TTL
   */
  async hmset(key: string, data: Record<string, any>, ttl?: number): Promise<boolean> {
    if (this.circuitBreakerOpen) return false;

    try {
      const serialized: Record<string, string> = {};
      for (const [k, v] of Object.entries(data)) {
        serialized[k] = typeof v === 'object' ? JSON.stringify(v) : String(v);
      }

      await redis.hset(key, serialized);
      
      const ttlWithJitter = this.getTTLWithJitter(ttl);
      await redis.expire(key, ttlWithJitter);
      
      return true;
    } catch (error) {
      logger.error('Redis hmset error', { key, error });
      this.openCircuitBreaker();
      return false;
    }
  }

  /**
   * Delete (Cache Invalidation)
   */
  async delete(key: string): Promise<boolean> {
    if (this.circuitBreakerOpen) return false;

    try {
      await redis.del(key);
      return true;
    } catch (error) {
      logger.error('Redis delete error', { key, error });
      this.openCircuitBreaker();
      return false;
    }
  }

  /**
   * Delete Multiple Keys
   */
  async deleteMany(keys: string[]): Promise<boolean> {
    if (this.circuitBreakerOpen || keys.length === 0) return false;

    try {
      await redis.del(...keys);
      return true;
    } catch (error) {
      logger.error('Redis deleteMany error', { keys, error });
      this.openCircuitBreaker();
      return false;
    }
  }

  /**
   * Tag-Based Invalidation
   * Add a key to a tag set for grouped invalidation
   */
  async addToTag(tag: string, key: string): Promise<boolean> {
    if (this.circuitBreakerOpen) return false;

    try {
      await redis.sadd(tag, key);
      return true;
    } catch (error) {
      logger.error('Redis addToTag error', { tag, key, error });
      return false;
    }
  }

  /**
   * Invalidate all keys under a tag
   */
  async invalidateTag(tag: string): Promise<boolean> {
    if (this.circuitBreakerOpen) return false;

    try {
      const keys = await redis.smembers(tag);
      if (keys.length > 0) {
        await redis.del(...keys);
      }
      await redis.del(tag); // Remove the tag set itself
      return true;
    } catch (error) {
      logger.error('Redis invalidateTag error', { tag, error });
      return false;
    }
  }

  /**
   * Get or Fetch with Request Coalescing
   * Prevents thundering herd by ensuring only one fetch per key
   */
  async getOrFetch<T>(
    key: string,
    fetchFn: () => Promise<T>,
    ttl?: number
  ): Promise<T | null> {
    // Check cache first
    const cached = await this.get<T>(key);
    if (cached !== null) return cached;

    // Check if there's already a pending request for this key
    if (this.pendingRequests.has(key)) {
      logger.info('Request coalescing: waiting for pending fetch', { key });
      return this.pendingRequests.get(key);
    }

    // Create new fetch promise
    const fetchPromise = (async () => {
      try {
        const data = await fetchFn();
        if (data) {
          await this.set(key, data, ttl);
        }
        return data;
      } finally {
        this.pendingRequests.delete(key);
      }
    })();

    this.pendingRequests.set(key, fetchPromise);
    return fetchPromise;
  }

  /**
   * Add jitter to TTL to prevent mass expiration
   */
  private getTTLWithJitter(ttl?: number): number {
    const baseTTL = ttl || this.BASE_TTL;
    const jitter = Math.floor(Math.random() * this.MAX_JITTER);
    return baseTTL + jitter;
  }

  /**
   * Parse hash data (convert JSON strings back to objects)
   */
  private parseHashData(data: Record<string, string>): Record<string, any> {
    const parsed: Record<string, any> = {};
    for (const [key, value] of Object.entries(data)) {
      try {
        parsed[key] = JSON.parse(value);
      } catch {
        parsed[key] = value;
      }
    }
    return parsed;
  }

  /**
   * Circuit Breaker: Open when Redis fails
   */
  private openCircuitBreaker(): void {
    if (!this.circuitBreakerOpen) {
      this.circuitBreakerOpen = true;
      logger.error('Redis circuit breaker opened');

      // Auto-close after 30 seconds
      setTimeout(() => {
        this.circuitBreakerOpen = false;
        logger.info('Redis circuit breaker closed');
      }, 30000);
    }
  }
}

export const cacheService = new RedisCacheService();