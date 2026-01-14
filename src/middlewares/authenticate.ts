import { Request, Response, NextFunction } from 'express';
import { asyncHandler } from './errorHandler';
import { UnauthorizedError } from '@/lib/api_response/error';
import { verifyAccessToken } from '@/lib/jwt';

const authenticate = asyncHandler(
  async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedError('No authentication token provided');
    }

    const [_, token] = authHeader.split(' ');

    const { userId, email, username } = await verifyAccessToken(token);

    req.userId = userId;
    req.email = email;
    req.username = username;

    next();
  },
);

export default authenticate;
