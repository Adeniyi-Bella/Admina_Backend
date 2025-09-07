/**
 * @copyright 2025 Adeniyi Bella
 * @license Apache-2.0
 */

/**
 * Node modules
 */
import { Schema, model } from 'mongoose';
import { Binary } from 'mongodb';
import { IPlans, IValues } from '@/types';

// Define TypeScript interface for an action plan
export interface IActionPlan {
  id: string;
  title?: string;
  dueDate?: Date;
  completed: boolean;
  location?: string;
}

export interface IDocument {
  userId: string;
  docId: string;
  chatBotPrompt?: IPlans;
  title?: string;
  sender?: string;
  receivedDate?: Date;
  summary: string;
  translatedText?: string;
  // structuredText?: string;
  pdfBlobStorage: boolean;
  targetLanguage: string;
  structuredTranslatedText?: Record<string, string>;
  actionPlan?: { title?: string; reason?: string }[];
  actionPlans?: IActionPlan[];
  createdAt?: Date;
  updatedAt?: Date;
}

/**
 * Sub-schemas
 */
const valuesSchema = new Schema<IValues>(
  {
    max: { type: Number, default: 0 },
    min: { type: Number, default: 0 },
    current: { type: Number, default: 0 },
  },
  { _id: false },
);

const plansSchema = new Schema<IPlans>(
  {
    premium: {
      type: valuesSchema,
      default: () => ({ max: 10, min: 0, current: 10 }),
    },
    free: {
      type: valuesSchema,
      default: () => ({ max: 0, min: 0, current: 0 }),
    },
  },
  { _id: false },
);

/**
 * Document schema
 */
const documentSchema = new Schema<IDocument>(
  {
    userId: {
      type: String,
      required: [true, 'User ID is required'],
    },
    docId: {
      type: String,
      required: [true, 'Document ID is required'],
    },

    chatBotPrompt: {
      type: plansSchema,
      default: () => ({
        premium: { max: 10, min: 0, current: 10 },
        free: { max: 0, min: 0, current: 0 },
      }),
    },

    title: {
      type: String,
      default: '',
    },
    sender: {
      type: String,
      default: '',
    },
    receivedDate: {
      type: Date,
    },
    summary: {
      type: String,
      default: '',
    },
    translatedText: {
      type: String,
      default: '',
    },
    pdfBlobStorage: {
      type: Boolean,
      required: true
    },
    targetLanguage: {
      type: String,
      default: '',
    },
    structuredTranslatedText: {
      type: Map,
      of: String,
      default: {},
    },
    actionPlan: {
      type: [{ title: String, reason: String }],
      default: [],
    },
    actionPlans: {
      type: [
        {
          id: {
            type: String,
            required: [true, 'Action Plan ID is required'],
          },
          title: {
            type: String,
            default: '',
          },
          dueDate: {
            type: Date,
          },
          completed: {
            type: Boolean,
            default: false,
          },
          location: {
            type: String,
            default: '',
          },
        },
      ],
      default: [],
      _id: false,
    },
  },
  {
    timestamps: true,
  },
);

export default model<IDocument>('Document', documentSchema);
