/**
 * @copyright 2025 Adeniyi Bella
 * @license Apache-2.0
 */

/**
 * Node modules
 */
import { jwtVerify, createRemoteJWKSet } from 'jose';

/**
 * Custom modules
 */
import config from '@/config';
// import { logger } from '@/lib/winston';


const JWKS = createRemoteJWKSet(
  new URL(
    `https://${config.AZURE_TENANT_ID}.ciamlogin.com/${config.AZURE_TENANT_ID}/discovery/v2.0/keys`,
  ),
);

export const verifyAccessToken = async (token: string) => {
  const [idToken, accessToken] = token.split('auth');

  // If there's no Bearer token, respond with 401 Unauthorized
  if (!idToken || !accessToken) {
    throw new Error('No access token or id token provided');
  }

  try {

    // Verify ID token
    const { payload: idTokenPayload } = await jwtVerify(idToken, JWKS, {
      issuer: `https://${config.AZURE_TENANT_ID}.ciamlogin.com/${config.AZURE_TENANT_ID}/v2.0`,
      audience: config.AZURE_CLIENT_ID,
    });

    // Verify ID token
    const { payload: accessTokenPayload } = await jwtVerify(accessToken, JWKS, {
      issuer: `https://${config.AZURE_TENANT_ID}.ciamlogin.com/${config.AZURE_TENANT_ID}/v2.0`,
      audience: "3e79848d-631d-4c2d-bfd5-11dbb8e5a21c",
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

    // Additional validation checks
    if (accessTokenPayload.exp! < Math.floor(Date.now() / 1000)) {
      throw new Error('Access token has expired');
    }
    if (idTokenPayload.exp! < Math.floor(Date.now() / 1000)) {
      throw new Error('ID token has expired');
    }

    return accessTokenPayload;
  } catch (error) {
    throw new Error('Unable to verify token');
  }
};

