"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyAccessToken = void 0;
const jose_1 = require("jose");
const winston_1 = require("../lib/winston");
const config_1 = __importDefault(require("../config"));
const msal_node_1 = require("@azure/msal-node");
const JWKS = (0, jose_1.createRemoteJWKSet)(new URL(`https://${config_1.default.AZURE_TENANT_ID}.ciamlogin.com/${config_1.default.AZURE_TENANT_ID}/discovery/v2.0/keys`));
const verifyAccessToken = (token) => __awaiter(void 0, void 0, void 0, function* () {
    const [idToken, accessToken] = token.split('auth');
    if (!idToken || !accessToken) {
        throw new Error('Token does not follow the expected format');
    }
    try {
        const { payload: idTokenPayload } = yield (0, jose_1.jwtVerify)(idToken, JWKS, {
            issuer: `https://${config_1.default.AZURE_TENANT_ID}.ciamlogin.com/${config_1.default.AZURE_TENANT_ID}/v2.0`,
            audience: config_1.default.AZURE_CLIENT_ID,
            clockTolerance: 3600,
        });
        const { payload: accessTokenPayload } = yield (0, jose_1.jwtVerify)(accessToken, JWKS, {
            issuer: `https://${config_1.default.AZURE_TENANT_ID}.ciamlogin.com/${config_1.default.AZURE_TENANT_ID}/v2.0`,
            audience: config_1.default.ADMINA_API_CLIENT_ID,
            clockTolerance: 3600,
        });
        if (accessTokenPayload.oid !== idTokenPayload.oid ||
            accessTokenPayload.tid !== idTokenPayload.tid ||
            accessTokenPayload.sid !== idTokenPayload.sid) {
            throw new Error('Token mismatch: Access and ID tokens are not from the same user/session.');
        }
        const authVerify = {
            auth: {
                clientId: config_1.default.AZURE_CLIENT_ID,
                clientSecret: config_1.default.AZURE_CLIENT_SECRETE,
                authority: config_1.default.AZURE_CLIENT_AUTHORITY,
            },
        };
        const cca = new msal_node_1.ConfidentialClientApplication(authVerify);
        const result = yield cca.acquireTokenByClientCredential({
            scopes: ['https://graph.microsoft.com/.default'],
        });
        if (!(result === null || result === void 0 ? void 0 : result.accessToken)) {
            winston_1.logger.error('Failed to verify user with secrete', {
                accessTokenPayload,
            });
            throw new Error('Failed to acquire Graph token');
        }
        const graphToken = yield cca.acquireTokenByClientCredential({
            scopes: ['https://graph.microsoft.com/.default'],
        });
        const userRes = yield fetch(`https://graph.microsoft.com/v1.0/users/${(accessTokenPayload.oid)}`, {
            headers: { Authorization: `Bearer ${graphToken.accessToken}` },
        });
        const user = yield userRes.json();
        const email = user.mail;
        const username = user.displayName;
        const oid = accessTokenPayload.oid;
        return { oid, email, username };
    }
    catch (error) {
        throw new Error('Unable to verify token');
    }
});
exports.verifyAccessToken = verifyAccessToken;
