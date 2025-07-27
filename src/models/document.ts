/**
 * @copyright 2025 Adeniyi Bella
 * @license Apache-2.0
 */

/**
 * Node modules
 */
import { Schema, model } from 'mongoose';

export interface IDocument {
  userId: string;
  docId: string;
  title?: string;
  sender?: string;
  receivedDate?: Date;
  summary?: string;
  originalText?: string;
  translatedText?: string;
  sourceLanguage?: string;
  targetLanguage?: string;
  actionPlan?: { title?: string; reason?: string }[];
  actionPlans?: { id: string; title?: string; dueDate?: Date; completed: boolean; location?: string }[];
}

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
      // unique: [true, 'Document ID must be unique'],
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
    originalText: {
      type: String,
      default: '',
    },
    translatedText: {
      type: String,
      default: '',
    },
    sourceLanguage: {
      type: String,
      default: '',
    },
    targetLanguage: {
      type: String,
      default: '',
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
            default: "",
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
  }
);


export default model<IDocument>('Document', documentSchema);