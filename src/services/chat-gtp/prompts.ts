/**
 * @copyright 2025 Adeniyi Bella
 * @license Apache-2.0
 */

export class Prompt {
  /**
   * Builds the prompt for restructuring text into a clearer and more readable layout.
   * @param text - The text to restructure.
   * @param label - The language label for the output (e.g., 'en', 'de').
   * @returns The formatted prompt string.
   */
  public structureTextPrompt(text: string, label: string): string {
    return `
   You are a helpful assistant. Read the following document and restructure its content into a clearer and more readable layout without summarizing or omitting any important information.

Preserve all original content, but reorganize and format it for improved readability.

Create a clear structure based on how the content is delivered — identify headings, subheadings, and logical groupings, tables, tick boxes mostly with X alone.

Use only well-formed HTML for output (no markdown, no JSON).

Use all possible semantic HTML tags such as <h1>, <h2>, <p>, <ul>, <li>, <strong>, <em>, <br>, <th>, <tb> etc., to improve clarity.

Add extra vertical spacing between sections using <br><br> or inline CSS margins to visually separate blocks.

The language of the output must match ${label}.

Document:
${text}
`.trim();
  }

  /**
   * Builds the prompt for OpenAI with the document text and target language.
   * @param translatedText - The document text to process.
   * @param targetLanguage - The language for the response.
   * @returns The formatted prompt string.
   */
  public buildPrompt(translatedText: string, targetLanguage: string): string {
    return `
You are an assistant that reads documents and extracts the following fields from the document:
- title of the Document (string)
- date document was received (date string in ISO 8601 format, e.g. "2024-05-24")
- sender of document (From which institution) (string)
- short summary (string)
- actionPlan: an array of { title: string, reason: string }
- actionPlans: an array of { title: string, due_date: date string ISO 8601, completed: boolean, location: string }

if there is no due date for any of the actionPlans, use the current date as the due date.
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
    { "title": "Submit all required documents online", "due_date": "2025-07-15T00:00:00Z", "completed": false, "location": "online portal" }
  ]
}

Document:
${translatedText}
`.trim();
  }
}

