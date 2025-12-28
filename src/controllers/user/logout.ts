// import { container } from 'tsyringe';
// import { logger } from '@/lib/winston';
// import { IUserService } from '@/services/users/user.interface';
// import { ApiResponse } from '@/lib/api_response';
// import type { Request, Response } from 'express';

// const logout = async (req: Request, res: Response): Promise<void> => {
//   const userService = container.resolve<IUserService>('IUserService');

//   try {
//     const user = await userService.checkIfUserExist(req);
//     if (!user) {
//       logger.error('User not found during downgradeUserPlan');
//       ApiResponse.notFound(res, 'User not found');
//       return;
//     }

//     await userService.updateUser(req.userId, 'logoutAt', false, new Date());

//     ApiResponse.noContent(res);
//   } catch (error: unknown) {
//     const errorMessage = error instanceof Error ? error.message : 'Unknown error';
//     logger.error('Error logging user out', errorMessage);
//     ApiResponse.serverError(res, 'Internal server error', errorMessage);
//   }
// };

// export default logout;
