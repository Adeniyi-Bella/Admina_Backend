/**
 * @copyright 2025 Adeniyi Bella
 * @license Apache-2.0
 */

import { IChatBotHistory } from '@/models/chatbotHistory.model';
import { Content, Part } from '@google/genai';

export class Prompt {
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

  public buildChatBotPrompt(
    chatBotHistory: IChatBotHistory,
    userPrompt: string,
    file?: Express.Multer.File,
  ): { systemInstruction: string; contents: Content[] } {
    const hasFile = !!file;

    const systemInstruction = `
You are an expert, highly knowledgeable assistant helping the user understand and discuss a document${hasFile ? ' and an attached file' : ''}.

Your goal is to provide clear, accurate, comprehensive, and genuinely helpful responses that enable the user to fully understand the topic and make informed decisions.

Context:
- Translated document text: ${chatBotHistory.translatedText || 'No translated text available'}
${hasFile ? '- The user has attached a specific file for you to analyze.' : ''}

Guidelines:
- Base your answers strictly on the translated text, the conversation history${hasFile ? ', and the content of the attached file' : ''}.
- Provide thorough and well-structured explanations when needed, not just brief summaries.
- Be factual, precise, and technically accurate.
- Anticipate follow-up questions and proactively clarify complex points.
- When appropriate, include links to official documentation, specifications, or trusted technical resources to guide the user further.
- Do not hallucinate information or fabricate sources.

Language Rule:
- Always respond in the same language as the user's current prompt (${userPrompt}), even if the document or attached file is written in a different language.
`.trim();

    const contents: Content[] = [];

    chatBotHistory.chats.forEach((chat) => {
      contents.push({ role: 'user', parts: [{ text: chat.userPrompt }] });
      if (chat.response) {
        contents.push({ role: 'model', parts: [{ text: chat.response }] });
      }
    });

    // 3. Construct the Current User Message
    const currentParts: Part[] = [];

    // A. Attach File (if present)
    if (file) {
      currentParts.push({
        inlineData: {
          mimeType: file.mimetype,
          data: file.buffer.toString('base64'),
        },
      });
    }

    // If a file is attached, we add a clear instruction to look at it.
    let finalUserText = userPrompt;
    if (hasFile) {
      finalUserText = `${userPrompt}\n\n[System Note: User has attached a file. Analyze it in context. Respond in the language of this prompt.]`;
    }

    currentParts.push({ text: finalUserText });

    // Push the final message
    contents.push({
      role: 'user',
      parts: currentParts,
    });

    return { systemInstruction, contents };
  }
}
