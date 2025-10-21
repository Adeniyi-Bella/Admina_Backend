/**
 * @copyright 2025 Adeniyi Bella
 * @license Apache-2.0
 */

import { IChatBotHistory } from '@/models/chatbotHistory.model';

export class Prompt {
  /**
   * Builds the userPrompt for restructuring text into a clearer and more readable layout.
   * @param text - The text to restructure.
   * @param label - The language label for the output (e.g., 'en', 'de').
   * @returns The formatted userPrompt string.
   */
  public structureTextPrompt(text: string, label: string): string {
    return `
   You are a helpful assistant. Read the following document and restructure its content into a clearer and more readable layout without summarizing or omitting any important information.

Preserve all original content, but reorganize and format it for improved readability.

Create a clear structure based on how the content is delivered — identify headings, subheadings, and logical groupings, tables and style them with inline tailwind css.

Use only well-formed HTML for output (no markdown, no JSON).

Use all possible semantic HTML tags such as <h1>, <h2>, <p>, <ul>, <li>, <strong>, <em>, <br>, <th>, <tb> etc., to improve clarity.

Add extra vertical spacing between sections using <br><br> or inline CSS margins to visually separate blocks.

The language of the output must match ${label}.

Document:
${text}
`.trim();
  }

  /**
   * Builds the userPrompt for Gemini AI with the document text and target language.
   * @param translatedText - The document text to process.
   * @param targetLanguage - The language for the response.
   * @returns The formatted userPrompt string.
   */
  public buildPromptForGeminiAI(targetLanguage: string): string {
    return `
You are an assistant that reads documents, translates them into ${targetLanguage}, and extracts the following fields from the translated text:

- translatedText (string)
- title of the Document (string)
- date document was received (date string in ISO 8601 format, e.g. "2024-05-24T00:00:00Z" or "${new Date().toISOString()}" if no date is provided)
- sender of document (from which institution) (string)
- A very good comprehensive summary of the document. This part is really important as the user needs to have a very good overview of the document with this comprehensive summary.
- actionPlan: an array of { title: string, reason: string }
- actionPlans: an array of { title: string, due_date: date string ISO 8601, completed: boolean, location: string }
- structuredTranslatedText HTML response of the translated text according to pages with proper inline Tailwind stylings { page1: string, page2: string, ... }

Assume the current date is "${new Date().toISOString()}".
If there is no due date for any of the actionPlans, use this current date as the due date.

**CRITICAL INSTRUCTIONS**:
- Respond with *raw JSON only*. Do NOT wrap the response in markdown, code fences (e.g., \`\`\`json or \`\`\`), or any other text.
- Ensure the response is valid JSON that can be parsed directly with JSON.parse().
- Do NOT include any explanatory text, comments, or extra characters outside the JSON object.
- Example of a correct response:
{
  "translatedText": "This is the translated text",
  "structuredTranslatedText": {
    "page1": "<p>Helios</p><h2>Helios Dr. Horst Schmidt</h2><h3>Wiesbaden Clinics</h3><p>Academic Teaching Hospital</p><p>of Johannes Gutenberg University Mainz</p><p>Helios Dr. Horst Schmidt Kliniken Wiesbaden</p><p>Gynecology and Obstetrics</p><p>Ludwig-Erhard-Straße 100 65199 Wiesbaden</p>"
  },
  "title": "Residence Permit Decision",
  "receivedDate": "2024-05-24T00:00:00Z",
  "sender": "Auslander Behorde",
  "summary": "Your residence permit is expiring soon and you need to apply for an extension at least 8 weeks before the expiration date (2023-12-15). You'll need to provide several documents and book an appointment online.",
  "actionPlan": [
    { "title": "Prepare valid passport", "reason": "A valid passport is required for the application." },
    { "title": "Gather current employment contract", "reason": "An employment contract is needed to prove employment status." }
  ],
  "actionPlans": [
    { "title": "Apply for residence permit extension", "due_date": "2025-07-01T00:00:00Z", "completed": false, "location": "Auslander Behorde office" },
    { "title": "Submit all required documents online", "due_date": "${new Date().toISOString()}", "completed": false, "location": "online portal" }
  ]
}
`;
  }

  /**
   * Builds the userPrompt for the chatbot, incorporating translated text, chat history, and the new userPrompt.
   * @param chatBotHistory - The chat history containing translatedText and chats.
   * @param userPrompt - The new user userPrompt.
   * @returns An array of messages for the OpenAI chat API.
   */
  public buildChatBotPrompt(
    chatBotHistory: IChatBotHistory,
    userPrompt: string,
  ): Array<{ role: 'system' | 'user' | 'assistant'; content: string }> {
    const messages: Array<{
      role: 'system' | 'user' | 'assistant';
      content: string;
    }> = [];

    // 1️⃣ Give the model document context and behavioral instructions
    messages.push({
      role: 'system',
      content: `
You are an expert assistant helping the user understand and discuss a document.

Use the following document context to formulate your responses:
- Translated document text: ${chatBotHistory.translatedText || 'No translated text available'}

Rules:
- Base your answers on the translated text and the ongoing conversation.
- Be concise, factual, and only answer questions related to the document context.
- If the question is unrelated, politely tell the user that you can only answer document-related questions.
- Always respond in the same language as the translated document unless the user specifies otherwise.
`.trim(),
    });

    // 2️⃣ Add all previous conversation messages in order
    chatBotHistory.chats.forEach((chat) => {
      messages.push({ role: 'user', content: chat.userPrompt });
      messages.push({ role: 'assistant', content: chat.response });
    });

    // 3️⃣ Finally, include the new user question
    messages.push({
      role: 'user',
      content: userPrompt,
    });

    return messages;
  }

  /**
   * Builds the userPrompt for OpenAI with the document text and target language.
   * @param translatedText - The document text to process.
   * @param targetLanguage - The language for the response.
   * @returns The formatted userPrompt string.
   */
  public buildPrompt(translatedText: string, targetLanguage: string): string {
    return `
You are an assistant that reads documents and extracts the following fields from the document:
- title of the Document (string)
- date document was received (date string in ISO 8601 format, e.g. "2024-05-24" or "${new Date().toISOString()}" if no date is provided)
- sender of document (From which institution) (string)
- comprehensive summary (string). A very good comprehensive summary of the document. This part is really important as the user needs to have a very good overview of the document with this comprehensive summary.
- actionPlan: an array of { title: string, reason: string }
- actionPlans: an array of { title: string, due_date: date string ISO 8601, completed: boolean, location: string }

Assume the current date is "${new Date().toISOString()}". 
if there is no due date for any of the actionPlans, use this current date as the due date.
Respond ONLY with valid raw JSON — do NOT include code fences, markdown, or extra text.
It is important that response should match the language ${targetLanguage}.

Example for an English Response:
{
  "title": "Residence Permit Decision",
  "receivedDate": "2024-05-24T00:00:00Z",
  "sender": "Auslander Behorde",
  "summary": "Your residence permit is expiring soon and you need to apply for an extension at least 8 weeks before the expiration date (2023-12-15). You'll need to provide several documents and book an appointment online.",
  "actionPlan": [
    { "title": "Prepare valid passport", "reason": "A valid passport is required for the application." },
    { "title": "Gather current employment contract", "reason": "An employment contract is needed to prove employment status." }
  ],
  "actionPlans": [
    { "title": "Apply for residence permit extension", "due_date": "2025-07-01T00:00:00Z", "completed": false, "location": "Auslander Behorde office" },
    { "title": "Submit all required documents online", "due_date": "new Date().toISOString()", "completed": false, "location": "online portal" }
  ]
}

Document:
${translatedText}
`.trim();
  }
}
