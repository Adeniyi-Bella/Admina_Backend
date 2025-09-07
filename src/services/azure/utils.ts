import { Response } from 'express';
import { logger } from '@/lib/winston';
import { ApiResponse } from '@/lib/api_response';

// Utility to send an SSE message and flush the response
export function sendSseMessage(res: Response, event: string, data: any): void {
  logger.info(event, { 'Status': data });
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
    logger.error(errorMessage, { 'Error is:': error.message });

    throw error;
  }
}
