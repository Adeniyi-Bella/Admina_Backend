"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Prompt = void 0;
class Prompt {
    structureTextPrompt(text, label) {
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
    buildPrompt(translatedText, targetLanguage) {
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
    buildChatBotPrompt(chatBotHistory, userPrompt) {
        const messages = [
            {
                role: 'system',
                content: `
You are an expert assistant helping the user understand a document and answer their questions.
Use the following context to formulate your response:
- Document translated text: ${chatBotHistory.translatedText || 'No translated text available'}
- Previous conversation: ${chatBotHistory.chats.length > 0
                    ? chatBotHistory.chats
                        .map((chat, index) => `User ${index + 1}: ${chat.userPrompt}\nAssistant ${index + 1}: ${chat.response}`)
                        .join('\n')
                    : 'No previous conversation'}
Provide a clear and concise response to the user's current userPrompt, using the document context and previous conversation to inform your answer.
Only answer questions directly related to the document context. If the userPrompts relates to another topic, please inform the user that you are only allowed to respond based on the topics related to the document. The response must be in the language of the Document translated text unless specified otherwise
by user.
`.trim(),
            },
            {
                role: 'user',
                content: userPrompt,
            },
        ];
        chatBotHistory.chats.forEach((chat) => {
            messages.push({ role: 'user', content: chat.userPrompt }, { role: 'assistant', content: chat.response });
        });
        return messages;
    }
}
exports.Prompt = Prompt;
