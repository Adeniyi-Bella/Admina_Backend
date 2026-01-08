/**
 * @copyright 2025 Adeniyi Bella
 * @license Apache-2.0
 */

/**
 * Node modules
 */
import { jwtVerify, createRemoteJWKSet } from 'jose';
import { logger } from '@/lib/winston';

/**
 * Custom modules
 */
import config from '@/config';
import { ConfidentialClientApplication } from '@azure/msal-node';

const JWKS = createRemoteJWKSet(
  new URL(
    `https://${config.AZURE_TENANT_ID}.ciamlogin.com/${config.AZURE_TENANT_ID}/discovery/v2.0/keys`,
  ),
);

export const verifyAccessToken = async (token: string) => {
  const [idToken, accessToken] = token.split('auth');

  // If there's no Bearer token, respond with 401 Unauthorized
  if (!idToken || !accessToken) {
    throw new Error('Token does not follow the expected format');
  }

  try {
    // Verify ID token
    const { payload: idTokenPayload } = await jwtVerify(idToken, JWKS, {
      issuer: `https://${config.AZURE_TENANT_ID}.ciamlogin.com/${config.AZURE_TENANT_ID}/v2.0`,
      audience: config.AZURE_CLIENT_ID,
      clockTolerance: 3600,
    });

    // Verify ID token
    const { payload: accessTokenPayload } = await jwtVerify(accessToken, JWKS, {
      issuer: `https://${config.AZURE_TENANT_ID}.ciamlogin.com/${config.AZURE_TENANT_ID}/v2.0`,
      audience: config.ADMINA_API_CLIENT_ID,
      clockTolerance: 3600,
    });

    if (
      accessTokenPayload.oid !== idTokenPayload.oid ||
      accessTokenPayload.tid !== idTokenPayload.tid ||
      accessTokenPayload.sid !== idTokenPayload.sid
    ) {
      throw new Error(
        'Token mismatch: Access and ID tokens are not from the same user/session.',
      );
    }

    const authVerify = {
      auth: {
        clientId: config.AZURE_CLIENT_ID!,
        clientSecret: config.AZURE_CLIENT_SECRETE!,
        authority: config.AZURE_CLIENT_AUTHORITY,
      },
    };

    const cca = new ConfidentialClientApplication(authVerify);

    const result = await cca.acquireTokenByClientCredential({
      scopes: ['https://graph.microsoft.com/.default'],
    });

    if (!result?.accessToken) {
      logger.error('Failed to verify user with secrete', {
        accessTokenPayload,
      });
      throw new Error('Failed to acquire Graph token');
    }

    const graphToken = await cca.acquireTokenByClientCredential({
      scopes: ['https://graph.microsoft.com/.default'],
    });

    const userRes = await fetch(
      `https://graph.microsoft.com/v1.0/users/${accessTokenPayload.oid}`,
      {
        headers: { Authorization: `Bearer ${graphToken!.accessToken}` },
      },
    );

    const user = await userRes.json();
    const email = user.mail;
    const username = user.displayName;
    const oid = accessTokenPayload.oid as string;

    return { oid, email, username };
  } catch (error: any) {
    const errorMessage = error.message || JSON.stringify(error);
    if (errorMessage.includes('7000222') || errorMessage.includes('7000215')) {
      logger.error(
        '🚨 CRITICAL SERVER ERROR: AZURE CLIENT SECRET HAS EXPIRED 🚨',
      );
      logger.error('PLEASE GENERATE A NEW SECRET IN AZURE PORTAL IMMEDIATELY');

      throw new Error('Internal Server Configuration Error');
    }

    logger.error('Token verification failed', { error });
    throw new Error('Unable to verify token');
  }
};
