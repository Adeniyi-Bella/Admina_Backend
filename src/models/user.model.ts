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
  privacyPolicyAccepted: boolean;
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
  { _id: false },
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
    standard: {
      type: valuesSchema,
      default: { max: 3, min: 0, current: 3 }, // default standard plan
    },

    free: {
      type: valuesSchema,
      default: { max: 2, min: 0, current: 2 }, // default free plan
    },
  },
  { _id: false },
);

/**
 * User schema
 */
const userSchema = new Schema<IUser>(
  {
    plan: {
      type: String,
      default: 'free',
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
    privacyPolicyAccepted: {
      type: Boolean,
      default: true,
    },
    lengthOfDocs: {
      type: plansSchema,
      default: {
        premium: { max: 7, min: 0, current: 7 },
        standard: { max: 5, min: 0, current: 5 },
        free: { max: 2, min: 0, current: 2 },
      },
    },

    userId: {
      type: String,
      required: [true, 'userId is required'],
      unique: true,
    },
  },
  {
    timestamps: true,
    strict: true,
  },
);

export default model<IUser>('User', userSchema);
