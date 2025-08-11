/**
 * @copyright 2025 Adeniyi Bella
 * @license Apache-2.0
 */

/**
 * Node modules
 */
import { IPlans, IValues } from '@/types';
import { Schema, model } from 'mongoose';

export interface IUser {
  plan: string;
  email: string;
  lengthOfDocs: IPlans;
  userId: string;
  username: string;
  createdAt: Date; 
  updatedAt: Date; 
}



/**
 * Values Schema (reusable for free & premium)
 */
const valuesSchema = new Schema<IValues>(
  {
    max: { type: Number, default: 0, min: 0 },
    min: { type: Number, default: 0, min: 0 },
    current: { type: Number, default: 0, min: 0 },
  },
  { _id: false }
);

/**
 * Plans Schema
 */
const plansSchema = new Schema<IPlans>(
  {
    premium: {
      type: valuesSchema,
      default: { max: 5, min: 0, current: 5 }, // default premium plan
    },
    free: {
      type: valuesSchema,
      default: { max: 2, min: 0, current: 2 }, // default free plan
    },
  },
  { _id: false }
);


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
    lengthOfDocs: {
      type: plansSchema,
      default: {
        premium: { max: 5, min: 0, current: 5 },
        free: { max: 2, min: 0, current: 2 },
      },
    },

    userId: {
      type: String,
      required: [true, 'userId is required'],
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

