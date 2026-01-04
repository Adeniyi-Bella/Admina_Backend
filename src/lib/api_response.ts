/**
 * Standard API Response Helper
 * Provides predefined methods for all common HTTP responses.
 */

import type { Request, Response } from 'express';

export class ApiResponse {
  private static version = '1.0.0';

  private static base(
    res: Response,
    httpCode: number,
    status: 'ok' | 'error',
    code: string,
    message: string,
    data?: any,
  ) {
    return res.status(httpCode).json({
      status,
      code,
      message,
      data,
      timestamp: new Date().toISOString(),
      version: this.version,
    });
  }

  static ok(res: Response, message: string, data?: any) {
    return this.base(res, 200, 'ok', 'OK', message, data);
  }

  static created(res: Response, message: string, data?: any) {
    return this.base(res, 201, 'ok', 'CREATED', message, data);
  }

  static noContent(res: Response) {
    return res.status(204).send();
  }

  static badRequest(res: Response, message: string, error?: any) {
    return this.base(res, 400, 'error', 'BAD_REQUEST', message, error);
  }

  static unauthorized(res: Response, message: string) {
    return this.base(res, 401, 'error', 'UNAUTHORIZED', message);
  }

  static forbidden(res: Response, message: string) {
    return this.base(res, 403, 'error', 'FORBIDDEN', message);
  }

  static notFound(res: Response, message: string) {
    return this.base(res, 404, 'error', 'NOT_FOUND', message);
  }

  /**
   * HTTP 429: Too Many Requests
   * Used when rate limits or queue limits are exceeded.
   */
  static tooManyRequests(res: Response, message: string = 'Too many requests, please try again later.') {
    return this.base(res, 429, 'error', 'TOO_MANY_REQUESTS', message);
  }

  /**
   * HTTP 503: Service Unavailable
   * Used when the worker/service is offline or under maintenance.
   */
  static serviceUnavailable(res: Response, message: string = 'Service temporarily unavailable.') {
    return this.base(res, 503, 'error', 'SERVICE_UNAVAILABLE', message);
  }

  static serverError(res: Response, message: string, error?: any) {
    return this.base(res, 500, 'error', 'SERVER_ERROR', message, error);
  }
}