import { Response } from 'express';
import { logger } from '@/lib/winston';

// Utility to send an SSE message and flush the response
export function sendSseMessage(res: Response, event: string, data: any): void {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  res.flush();
}

// Utility to handle async operations with SSE error handling
export async function handleSseAsyncOperation<T>(
  res: Response,
  operation: () => Promise<T>,
  errorMessage: string,
): Promise<T> {
  try {
    const result = await operation();
    return result;
  } catch (error: any) {
    logger.error(errorMessage, { "Error is:": error.message });
    res.status(500).write(
      `event: error\ndata: ${JSON.stringify({
        code: 'ServerError',
        message: 'Failed to process document',
        error: errorMessage,
        errorStatus: 500,
      })}\n\n`,
    );
    res.end();
    throw error; // Rethrow to allow caller to handle early termination
  }
}