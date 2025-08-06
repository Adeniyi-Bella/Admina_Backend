/**
 * @copyright 2025 Adeniyi Bella
 * @license Apache-2.0
 */

/**
 * Node modules
 */
import { Schema, model } from 'mongoose';

export interface IUser {
  plan: string;
  email: string;
  prompt: number;
  lenghtOfDocs: number;
  userId: string;
  username: string;
  createdAt: Date; 
  updatedAt: Date; 
}

/**
 * User schema
 */
const userSchema = new Schema<IUser>(
  {
    plan: {
      type: String,
      default: "free"
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: [true, 'Email must be unique'],
    },
    username: {
      type: String,
      required: [true, 'Username is required'],
    },
    lenghtOfDocs: {
      type: Number,
      default: 0,
      min: [0, 'lenghtOfDocs cannot be negative'],
    },
    userId: {
      type: String,
      required: [true, 'userId is required'],
    },
    prompt: {
      type: Number,
      default: 5
    },
  },
  {
    timestamps: true,
    strict: true,
  },
);

// userSchema.pre('save', async function (next) {
//   next();
// });

export default model<IUser>('User', userSchema);

