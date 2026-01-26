/**
 * @copyright 2025 Adeniyi Bella
 * @license Apache-2.0
 */

/**
 * Node modules
 */
import { Schema, model } from 'mongoose';
import { IPlans, IValues } from '@/types';

// Define TypeScript interface for an action plan
export interface IActionPlan {
  id: string;
  title?: string;
  dueDate?: Date;
  completed: boolean;
  location?: string;
}

export const ChatbotPlanLimits = {
  free: { max: 20, min: 0, current: 20 },
  standard: { max: 10, min: 0, current: 10 },
  premium: { max: 5, min: 0, current: 5 },
};

export type ChatBotPlanType = keyof typeof ChatbotPlanLimits;

export interface IDocument {
  userId: string;
  docId: string;
  chatBotPrompt?: IPlans;
  title?: string;
  sender?: string;
  receivedDate?: Date;
  summary?: string;
  translatedText?: string;
  pdfBlobStorage: boolean;
  targetLanguage?: string;
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
    premium: { type: valuesSchema },
    standard: { type: valuesSchema },
    free: { type: valuesSchema },
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
        premium: ChatbotPlanLimits.premium,
        standard: ChatbotPlanLimits.standard,
        free: ChatbotPlanLimits.free,
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
      required: true,
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

documentSchema.index({ userId: 1, createdAt: 1 });
documentSchema.index({ userId: 1, docId: 1 }, { unique: true });

export default model<IDocument>('Document', documentSchema);
