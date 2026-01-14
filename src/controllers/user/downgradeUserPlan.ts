// import { container } from 'tsyringe';
// import { logger } from '@/lib/winston';
// import { IUserService } from '@/services/users/user.interface';
// import { IDocumentService } from '@/services/document/document.interface';
// import { ApiResponse } from '@/lib/api_response';
// import { IPlans } from '@/types';
// import type { Request, Response } from 'express';

// const downgradeUserPlan = async (req: Request, res: Response): Promise<void> => {
//   const userService = container.resolve<IUserService>('IUserService');
//   const docService = container.resolve<IDocumentService>('IDocumentService');

//   try {
//     const user = await userService.checkIfUserExist(req);
//     if (!user) {
//       logger.error('User not found during downgradeUserPlan');
//       ApiResponse.notFound(res, 'User not found');
//       return;
//     }

//     const currentPlan = user.plan;
//     const planToDowngradeTo = req.params.plan;
//     const allowedPlans = ['standard', 'free'];
//     if (!allowedPlans.includes(planToDowngradeTo)) {
//       logger.error(`Invalid target plan: ${planToDowngradeTo}`);
//       ApiResponse.badRequest(
//         res,
//         `Invalid target plan: ${planToDowngradeTo}. Must be "standard" or "free".`
//       );
//       return;
//     }
//     switch (currentPlan) {
//       case 'free':
//         logger.error('Free plan cannot be downgraded further');
//         ApiResponse.badRequest(res, 'Free plan cannot be downgraded further');
//         return;
//       case 'standard':
//         if (planToDowngradeTo !== 'free') {
//           logger.error('Standard plan can only be downgraded to free');
//           ApiResponse.badRequest(res, 'Standard plan can only be downgraded to free');
//           return;
//         }
//         break;
//       case 'premium':
//         break;
//       default:
//         logger.error(`Unknown current plan: ${currentPlan}`);
//         ApiResponse.badRequest(res, `Unknown current plan: ${currentPlan}`);
//         return;
//     }
//     await userService.updateUser(req.userId, 'plan', false, planToDowngradeTo);
//     const newLengthOfDocs: IPlans =
//       planToDowngradeTo === 'standard'
//         ? { standard: { max: 3, min: 0, current: 3 } }
//         : { free: { max: 2, min: 0, current: 2 } };

//     await userService.updateUser(req.userId, 'lengthOfDocs', false, newLengthOfDocs);
//     const maxDocsForPrevPlan =
//       currentPlan === 'premium'
//         ? user.lengthOfDocs.premium!.max
//         : user.lengthOfDocs.standard!.max;

//     const { documents } = await docService.getAllDocumentsByUserId(
//       user,
//       maxDocsForPrevPlan,
//       0
//     );

//     const newChatBotPrompt: IPlans =
//       planToDowngradeTo === 'standard'
//         ? { standard: { max: 5, min: 0, current: 5 } }
//         : { free: { max: 0, min: 0, current: 0 } };

//     for (const doc of documents) {
//       await docService.updateDocument(req.userId, doc.docId, {
//         chatBotPrompt: newChatBotPrompt,
//       });
//     }

//     logger.info(
//       `User downgraded successfully from ${currentPlan} to ${planToDowngradeTo} and documents updated`,
//        {
//           user: {
//             id: user.userId,
//             email: user.email,
//           },
//         },
//     );

//     ApiResponse.ok(res, 'User downgraded successfully');
//   } catch (error: unknown) {
//     const errorMessage = error instanceof Error ? error.message : 'Unknown error';
//     logger.error('Error downgrading user', errorMessage);
//     ApiResponse.serverError(res, 'Internal server error', errorMessage);
//   }
// };

// export default downgradeUserPlan;
