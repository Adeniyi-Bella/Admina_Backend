/**
 * @copyright 2025 Adeniyi Bella
 * @license Apache-2.0
 */

/**
 * Node modules
 */
import { JsonWebTokenError, TokenExpiredError } from 'jsonwebtoken';

/**
 * Custom modules
 */
import { verifyAccessToken } from '@/lib/jwt';
import { logger } from '@/lib/winston';

/**
 * Types
 */
import type { Request, Response, NextFunction } from 'express';

/**
 * @function authenticate
 * @description Middleware to verify the user's access token from the Authorization header.
 *              If the token is valid, the user's ID, email and username is attached to the request object.
 *              Otherwise, it returns an appropriate error response.
 *
 * @param {Request} req - Express request object. Expects a Bearer token in the Authorization header.
 * @param {Response} res - Express response object used to send error responses if authentication fails.
 * @param {NextFunction} next - Express next function to pass control to the next middleware.
 *
 * @returns {void}
 **/
const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  const authHeader = req.headers.authorization;

  // If there's no Bearer token, respond with 401 Unauthorized
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({
      code: 'AuthenticationError',
      message: 'Access denied, no token provided',
    });
    return;
  }

  // Split out the token from the 'Bearer' prefix
  const [_, token] = authHeader.split(' ');

  //Split the accessToken from the token
  // const [__, accessToken] = token.split('auth');

  try {
    // Verify the token and extract the userId from the payload
    const jwtPayload = (await verifyAccessToken(token)) as {
      oid: string;
      preferred_username: string;
      name: string;
    };

    if (!jwtPayload.oid) {
      throw new Error('Access token invalid');
    }
    req.userId = jwtPayload.oid;
    req.email = jwtPayload.preferred_username;
    req.username = jwtPayload.name;

    // Proceed to the next middleware or route handler
    return next();
  } catch (error) {
    // Handle expired token error
    if (error instanceof TokenExpiredError) {
      res.status(401).json({
        code: 'AuthenticationError',
        message: 'Access token expired, request a new one with refresh token',
      });
      return;
    }

    // Handle invalid token error
    if (error instanceof JsonWebTokenError) {
      res.status(401).json({
        code: 'AuthenticationError',
        message: 'Access token invalid',
      });
      return;
    }

    res.status(500).json({
      code: 'ServerError',
      message: 'Internal server error',
      // error: error instanceof Error ? { message: error.message } : error,
    });
    logger.error('Error in authenticate middleware', {
      error:
        error instanceof Error
          ? { message: error.message, stack: error.stack }
          : error,
    });

  }
};

export default authenticate;
