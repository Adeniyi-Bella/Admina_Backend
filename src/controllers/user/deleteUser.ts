// /**
//  * @copyright 2025 Adeniyi Bella
//  * @license Apache-2.0
//  */

// /**
//  * Node modules
//  */
// import { container } from 'tsyringe';

// /**
//  * Custom modules
//  */
// import { logger } from '@/lib/winston';

// /**
//  * Interfaces
//  */
// import { IUserService } from '@/services/users/user.interface';
// import { IDocumentService } from '@/services/document/document.interface';

// /**
//  * Types
//  */
// import type { Request, Response } from 'express';
// import { ApiResponse } from '@/lib/api_response';
// import { IChatBotService } from '@/services/chatbot/chatbot.interface';

// const deleteUser = async (req: Request, res: Response): Promise<void> => {
//   const userService = container.resolve<IUserService>('IUserService');
//   const chatBotService = container.resolve<IChatBotService>('IChatBotService');
//   const documentService =
//     container.resolve<IDocumentService>('IDocumentService');

//   try {
//     await documentService.deleteAllDocuments(req.userId);

//     // Delete all chat history for the user
//     await chatBotService.deleteChatHistoryByUserId(req.userId);

//     const userEmail = await userService.deleteUser(req.userId);

//     if (!userEmail) {
//       logger.error('User not found in database for deletion');
//       ApiResponse.notFound(res, 'User not found');
//       return;
//     }

//     const deleteUserFromEntraId = await userService.deleteUserFromEntraId(
//       req.userId,
//     );
//     if (!deleteUserFromEntraId) {
//       logger.error('User not found in Entra Id for deletion');
//       ApiResponse.notFound(res, 'User not found in Entra Id');
//       return;
//     }

//     await userService.archiveUser(userEmail);
    
//     logger.info('User deleted successfully');

//     ApiResponse.noContent(res);
//   } catch (error: unknown) {
//     logger.error('Error deleting document', error);
//     // Check if error is an instance of Error to safely access message
//     const errorMessage =
//       error instanceof Error ? error.message : 'Unknown error';
//     ApiResponse.serverError(res, 'Internal server error', errorMessage);
//   }
// };

// export default deleteUser;
