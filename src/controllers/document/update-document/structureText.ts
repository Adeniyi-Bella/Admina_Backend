// import { logger } from '@/lib/winston';
// import { IOpenAIService } from '@/services/ai-models/openai.interface';
// import { IDocumentService } from '@/services/document/document.interface';
// import type { Request, Response } from 'express';
// import { container } from 'tsyringe';
// import { ApiResponse } from '@/lib/api_response';

// const structureText = async (req: Request, res: Response): Promise<void> => {
//   const documentService =
//     container.resolve<IDocumentService>('IDocumentService');
//   const openAIService = container.resolve<IOpenAIService>('IOpenAIService');

//   try {
//     const userId = req.userId;
//     const docId = req.params.docId;

//     const document = await documentService.getDocument(userId!, docId);

//     if (!document) {
//       ApiResponse.notFound(res, 'Document not found');
//       return;
//     }

//     // Check if structured text fields already have content
//     const hasStructuredText =
//       typeof document.structuredTranslatedText === 'object' &&
//       Object.keys(document.structuredTranslatedText).length > 0;

//     if (hasStructuredText) {
//       ApiResponse.ok(res, 'Document fetched successfully', { document });
//       return;
//     }

//     const structuredTranslatedText = await openAIService.structureText(
//       document.translatedText!,
//       document.targetLanguage,
//     );

//     // Update the document with structured texts
//     const updatedDocument = await documentService.updateDocument(
//       userId!,
//       docId,
//       {
//         structuredTranslatedText,
//       },
//     );
//     ApiResponse.ok(res, 'Document fetched successfully', {
//       document: updatedDocument,
//     });
//   } catch (err) {
//     ApiResponse.serverError(res, 'Internal server error', err);

//     logger.error('Error while getting document by userId and docId', err);
//   }
// };

// export default structureText;
