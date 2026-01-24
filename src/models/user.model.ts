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
  status: 'active' | 'deleted';
  deletedAt?: Date;
  permanentDeleteAt?: Date;

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
      default: { max: 7, min: 0, current: 7 }, // default premium plan
    },
    standard: {
      type: valuesSchema,
      default: { max: 5, min: 0, current: 5 }, // default standard plan
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
    },

    userId: {
      type: String,
      required: [true, 'userId is required'],
      unique: true,
    },

    /** 
     * Status Management for Soft Delete 
     */
    status: {
      type: String,
      enum: ['active', 'deleted'],
      default: 'active',
    },
    deletedAt: {
      type: Date,
      default: null,
    },
    // This field controls when MongoDB actually removes the document
    permanentDeleteAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    strict: true,
  },
);

/**
 * TTL INDEX CONFIGURATION
 * MongoDB will auto-delete the document when the server time >= permanentDeleteAt
 * expireAfterSeconds: 0 means "Delete immediately at the specified date"
 */
userSchema.index({ permanentDeleteAt: 1 }, { expireAfterSeconds: 0 });

export default model<IUser>('User', userSchema);
