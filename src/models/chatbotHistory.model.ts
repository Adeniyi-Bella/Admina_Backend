/**
 * @copyright 2025 Adeniyi Bella
 * @license Apache-2.0
 */

/**
 * Node modules
 */
import { Schema, model } from 'mongoose';

// Define TypeScript interface for chat message
export interface IChatMessage {
  userPrompt: string;
  response: string;
  time: Date;
}

// Define TypeScript interface for chatbot history
export interface IChatBotHistory {
  userId: string;
  docId: string;
  translatedText?: string;
  chats: IChatMessage[];
  createdAt: Date;
  updatedAt: Date;
}

/**
 * ChatBotHistory schema
 */
const chatBotHistorySchema = new Schema<IChatBotHistory>(
  {
    userId: {
      type: String,
      required: [true, 'User ID is required'],
    },
    docId: {
      type: String,
      required: [true, 'Document ID is required'],
    },
    translatedText: {
      type: String,
      default: '',
    },
    chats: {
      type: [
        {
          userPrompt: {
            type: String,
            required: [true, 'Prompt is required'],
          },
          response: {
            type: String,
            required: [true, 'Response is required'],
          },
          time: {
            type: Date,
            default: Date.now,
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

export default model<IChatBotHistory>('ChatBotHistory', chatBotHistorySchema);
