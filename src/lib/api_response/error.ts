/**
 * @copyright 2025 Adeniyi Bella
 * @license Apache-2.0
 */

/**
 * Base Application Error
 * All custom errors extend from this class
 */
export abstract class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly code: string;

  constructor(message: string, statusCode: number, code: string, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = isOperational;

    // Maintains proper stack trace for where error was thrown
    Error.captureStackTrace(this, this.constructor);
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * 400 Bad Request Errors
 */
export class BadRequestError extends AppError {
  constructor(message: string = 'Bad Request', code: string = 'BAD_REQUEST') {
    super(message, 400, code);
  }
}

export class ValidationError extends BadRequestError {
  public readonly errors?: any;

  constructor(message: string = 'Validation failed', errors?: any) {
    super(message, 'VALIDATION_ERROR');
    this.errors = errors;
  }
}

export class InvalidInputError extends BadRequestError {
  constructor(message: string = 'Invalid input provided') {
    super(message, 'INVALID_INPUT');
  }
}

/**
 * 401 Unauthorized Errors
 */
export class UnauthorizedError extends AppError {
  constructor(message: string = 'Unauthorized', code: string = 'UNAUTHORIZED') {
    super(message, 401, code);
  }
}

export class TokenExpiredError extends UnauthorizedError {
  constructor(message: string = 'Token has expired') {
    super(message, 'TOKEN_EXPIRED');
  }
}

export class InvalidTokenError extends UnauthorizedError {
  constructor(message: string = 'Invalid or malformed token') {
    super(message, 'INVALID_TOKEN');
  }
}

export class TokenMismatchError extends UnauthorizedError {
  constructor(message: string = 'Token mismatch detected') {
    super(message, 'TOKEN_MISMATCH');
  }
}

/**
 * 403 Forbidden Errors
 */
export class ForbiddenError extends AppError {
  constructor(message: string = 'Access forbidden', code: string = 'FORBIDDEN') {
    super(message, 403, code);
  }
}

export class ReregistrationBlockedError extends ForbiddenError {
  constructor(message: string = 'You cannot re-register in the same month you deleted your account.') {
    super(message, 'REREGISTRATION_BLOCKED');
  }
}

export class PlanUpgradeError extends ForbiddenError {
  constructor(message: string) {
    super(message, 'PLAN_UPGRADE_ERROR');
  }
}

export class PlanDowngradeError extends ForbiddenError {
  constructor(message: string) {
    super(message, 'PLAN_DOWNGRADE_ERROR');
  }
}

/**
 * 404 Not Found Errors
 */
export class NotFoundError extends AppError {
  constructor(message: string = 'Resource not found', code: string = 'NOT_FOUND') {
    super(message, 404, code);
  }
}

export class UserNotFoundError extends NotFoundError {
  constructor(message: string = 'User not found') {
    super(message, 'USER_NOT_FOUND');
  }
}

export class DocumentNotFoundError extends NotFoundError {
  constructor(message: string = 'Document not found') {
    super(message, 'DOCUMENT_NOT_FOUND');
  }
}

export class ActionPlanNotFoundError extends NotFoundError {
  constructor(message: string = 'Action plan not found') {
    super(message, 'ACTION_PLAN_NOT_FOUND');
  }
}

/**
 * 429 Too Many Requests
 */
export class TooManyRequestsError extends AppError {
  constructor(message: string = 'Too many requests, please try again later') {
    super(message, 429, 'TOO_MANY_REQUESTS');
  }
}

/**
 * 500 Internal Server Errors
 */
export class InternalServerError extends AppError {
  constructor(message: string = 'Internal server error', code: string = 'SERVER_ERROR') {
    super(message, 500, code, false);
  }
}

export class DatabaseError extends InternalServerError {
  constructor(message: string = 'Database operation failed') {
    super(message, 'DATABASE_ERROR');
  }
}

export class ExternalServiceError extends InternalServerError {
  constructor(message: string = 'External service error', code: string = 'EXTERNAL_SERVICE_ERROR') {
    super(message, code);
  }
}

export class AzureAuthError extends ExternalServiceError {
  constructor(message: string = 'Azure authentication failed') {
    super(message, 'AZURE_AUTH_ERROR');
  }
}

export class GraphAPIError extends ExternalServiceError {
  constructor(message: string = 'Microsoft Graph API error') {
    super(message, 'GRAPH_API_ERROR');
  }
}

export class AzureSecretExpiredError extends InternalServerError {
  constructor(message: string = 'Azure client secret has expired') {
    super(message, 'AZURE_SECRET_EXPIRED');
  }
}

/**
 * 503 Service Unavailable
 */
export class ServiceUnavailableError extends AppError {
  constructor(message: string = 'Service temporarily unavailable') {
    super(message, 503, 'SERVICE_UNAVAILABLE');
  }
}

export class CacheError extends InternalServerError {
  constructor(message: string = 'Cache operation failed') {
    super(message, 'CACHE_ERROR');
  }
}

/**
 * Error Serializer
 * Safely converts Error objects into loggable JSON
 */
export class ErrorSerializer {
  static serialize(error: unknown) {
    if (!error) return undefined;

    // AppError (your custom errors)
    if (error instanceof AppError) {
      return {
        name: error.name,
        message: error.message,
        code: error.code,
        statusCode: error.statusCode,
        isOperational: error.isOperational,
        stack: error.stack,
        ...(error as any).errors && { errors: (error as any).errors },
      };
    }

    // Native Error
    if (error instanceof Error) {
      return {
        name: error.name,
        message: error.message,
        stack: error.stack,
      };
    }

    // Mongo / Mongoose error object
    if (typeof error === 'object') {
      return {
        ...error,
      };
    }

    // Fallback (string, number, etc.)
    return {
      value: error,
    };
  }
}
