/**
 * @copyright 2025 Adeniyi Bella
 * @license Apache-2.0
 */

/**
 * Node modules
 */
import { Schema, model } from 'mongoose';

export interface IDeletedUsers {
  email: string;
  deletedAt: Date;
}

/**
 * Deleted Users schema
 */
const userDeletedSchema = new Schema<IDeletedUsers>(
  {
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: [true, 'Email must be unique'],
    },
    deletedAt: {
      type: Date,
      required: true,
    },
  },
  { timestamps: false },
);

export default model<IDeletedUsers>('DeletedUsers', userDeletedSchema);
