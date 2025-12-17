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

  public buildPromptForTranslateDocument(targetLanguage: string): string {
    return `
      You are a translation assistant. ALL OUTPUT MUST BE IN ${targetLanguage}. 
      If you ever include any text that is not in ${targetLanguage}, the response will be considered INVALID.

      Task:
      Analyze the document provided. Ignore all images, photos, logos, diagrams, and visual artifacts. 
      Extract only the legible text, translate it into ${targetLanguage}, and produce a JSON object with the following properties only:

      - "translatedText": a single string containing the FULL translated document text in ${targetLanguage}.
      - "structuredTranslatedText": an object mapping page keys to HTML strings for each page, e.g. { "page1": "...", "page2": "..." }.
        Each page string must be valid HTML (semantic tags) and include only the translated text (no original-language text), with inline Tailwind CSS classes allowed.

      REQUIRED FORMAT (must be raw JSON only):
      - Respond with raw JSON only. Do NOT add any surrounding text, Markdown, or code fences.
      - The JSON must parse with JSON.parse() without error.
      - Property names must be exactly: translatedText, structuredTranslatedText.

      IMPORTANT BEHAVIORAL RULES:
      1. ALL textual content (including inside structuredTranslatedText HTML) MUST BE IN ${targetLanguage}. Do NOT include any original-language fragments or English.
      2. The value of translatedText MUST EXACTLY MATCH the textual content inside the structuredTranslatedText HTML (ignoring HTML tags). They must contain the same translation.
      3. Use semantic HTML elements (p, h1-h6, ul/li, etc.). You may include inline Tailwind classes on those tags.
      4. Do NOT include any additional properties, metadata, comments, or explanatory text.
      5. If you cannot translate or detect the language, return this JSON with an "error" property explaining the issue, and no other text: { "error": "explanation in ${targetLanguage}" }.
      6. If the translation would be identical to the input (e.g., input already in ${targetLanguage}), still return the JSON object with translatedText in ${targetLanguage}.
      
      7. **STRICTLY IGNORE IMAGES AND GRAPHICS**: 
         - Do NOT attempt to translate text inside complex logos, stamps, or low-quality images.
         - Do NOT write descriptions of images (e.g., do NOT write "[Logo]", "[Signature]", or "[Image of house]"). 
         - Do NOT use HTML <img> tags. 
         - Focus ONLY on the main body text, headers, and tables.

      PLACEHOLDER EXAMPLE (do NOT return this example; output must be real JSON as specified):
      {
        "translatedText": "<TRANSLATED_TEXT_IN_${targetLanguage}>",
        "structuredTranslatedText": {
          "page1": "<p class=\"text-base\">&lt;TRANSLATED_TEXT_FOR_PAGE_1_IN_${targetLanguage}&gt;</p>"
        }
      }

      Remember:
      - Raw JSON only. No markdown, no code fences, no explanation.
      - All content must be in ${targetLanguage}.
      - IGNORE IMAGES.
      `;
  }

  public buildPromptForSummarizeDocument(
    translatedText: string,
    language: string,
  ): string {
    return `
You are a multilingual document analysis assistant.

Your task:
1. Carefully read the following document written in ${language}.
2. Extract structured information and produce a concise, factual JSON summary.
3. **All textual fields (title, sender, summary, action plan, action plans, etc.) must be written fully in ${language}.**

---

### DOCUMENT CONTENT
${translatedText}

---

### OUTPUT FORMAT
Return only **raw JSON** (no markdown, no code fences, no explanations).
The JSON must include these exact keys and meanings:

{
  "title": "string — short descriptive title of the document (in ${language})",
  "receivedDate": "string — date when the document was received (ISO 8601 format, e.g. ${new Date().toISOString()})",
  "sender": "string — name of the person, organization, or institution that sent or authored the document (in ${language})",
  "summary": "string — comprehensive and factual summary of the document’s full content (in ${language})",

  "actionPlan": [
    {
      "title": "string — key point, recommendation, or insight derived from the document (in ${language})",
      "reason": "string — explanation or context for why this key point or recommendation is important (in ${language})"
    }
  ],

  "actionPlans": [
    {
      "title": "string — specific actionable task the user should perform based on this document (in ${language})",
      "due_date": "string — ISO 8601 date by which this task should be completed",
      "completed": false,
      "location": "string — where or in what context this action should take place (in ${language})"
    }
  ]
}

---

### DIFFERENCE BETWEEN actionPlan AND actionPlans
- **actionPlan** = Key insights or recommendations *summarized from* the document. Think of them as what the document is *telling or advising* the reader.
  - Example: “Renew your ID before expiry.” / “Keep record of transaction history.”
- **actionPlans** = Specific actionable tasks the *user needs to do* as a result of the document.
  - Example: “Visit the municipal office to renew ID before 2025-12-31.” / “Send follow-up email to finance department.”

---

### CRITICAL INSTRUCTIONS
- All text must be written fully in ${language}.
- If the document is already in ${language}, keep it in that same language.
- Avoid English or mixed-language responses.
- Ensure the JSON is valid and can be parsed directly with \`JSON.parse()\`.
- Do NOT include markdown, explanations, or text outside the JSON.
- If any information is missing, infer it if possible, or leave the field as an empty string ("").

---

### EXAMPLE (placeholders only — do not output in English):
{
  "title": "<TITOLO_DEL_DOCUMENTO>",
  "receivedDate": "${new Date().toISOString()}",
  "sender": "<MITTENTE>",
  "summary": "<RIASSUNTO_COMPLETO_IN_${language.toUpperCase()}>",
  "actionPlan": [
    { "title": "<PUNTO_CHIAVE>", "reason": "<SPIEGAZIONE>" }
  ],
  "actionPlans": [
    { "title": "<AZIONE_DA_FARE>", "due_date": "${new Date().toISOString()}", "completed": false, "location": "<LUOGO>" }
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
