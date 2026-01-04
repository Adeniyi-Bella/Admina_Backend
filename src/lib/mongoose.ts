/**
 * @copyright 2025 Adeniyi Bella
 * @license Apache-2.0
 */

/**
 * Node modules
 */
import mongoose from 'mongoose';

/**
 * Custom modules
 */
import config from '@/config';
import { logger } from '@/lib/winston';

/**
 * Types
 */
import type { ConnectOptions } from 'mongoose';

/**
 * Client option
 */
const clientOptions: ConnectOptions = {
  dbName: 'Admina-Api',
  appName: 'Admina-Api',
  serverApi: {
    version: '1',
    strict: true,
    deprecationErrors: true,
  },
};

/**
 * Establishes a connection to the MongoDB database using Mongoose.
 *
 * @param context - The name of the process connecting (e.g., 'Server', 'Worker')
 */
export const connectToDatabase = async (
  context: string = 'Application',
): Promise<void> => {
  if (!config.MONGO_URI) {
    throw new Error('MongoDB URI is not defined in the configuration.');
  }

  // If already connected, skip
  if (mongoose.connection.readyState === 1) {
    logger.info(`${context} is already connected to MongoDB.`);
    return;
  }

  try {
    await mongoose.connect(config.MONGO_URI, clientOptions);

    logger.info(`✅ ${context} connected to the database successfully.`, {
      uri: config.MONGO_URI,
      context,
    });
  } catch (err) {
    if (err instanceof Error) {
      throw err;
    }
    logger.error(`Error connecting ${context} to the database`, err);
    throw new Error('Database connection failed');
  }
};

/**
 * Disconnects from the MongoDB database using Mongoose.
 *
 * @param context - The name of the process disconnecting (e.g., 'Server', 'Worker')
 */
export const disconnectFromDatabase = async (
  context: string = 'Application',
): Promise<void> => {
  try {
    await mongoose.disconnect();

    logger.info(`🛑 ${context} disconnected from the database successfully.`);
  } catch (err) {
    if (err instanceof Error) {
      throw new Error(err.message);
    }
    logger.error(`Error disconnecting ${context} from the database`, err);
  }
};