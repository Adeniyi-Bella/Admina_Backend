"use strict";
var __esDecorate = (this && this.__esDecorate) || function (ctor, descriptorIn, decorators, contextIn, initializers, extraInitializers) {
    function accept(f) { if (f !== void 0 && typeof f !== "function") throw new TypeError("Function expected"); return f; }
    var kind = contextIn.kind, key = kind === "getter" ? "get" : kind === "setter" ? "set" : "value";
    var target = !descriptorIn && ctor ? contextIn["static"] ? ctor : ctor.prototype : null;
    var descriptor = descriptorIn || (target ? Object.getOwnPropertyDescriptor(target, contextIn.name) : {});
    var _, done = false;
    for (var i = decorators.length - 1; i >= 0; i--) {
        var context = {};
        for (var p in contextIn) context[p] = p === "access" ? {} : contextIn[p];
        for (var p in contextIn.access) context.access[p] = contextIn.access[p];
        context.addInitializer = function (f) { if (done) throw new TypeError("Cannot add initializers after decoration has completed"); extraInitializers.push(accept(f || null)); };
        var result = (0, decorators[i])(kind === "accessor" ? { get: descriptor.get, set: descriptor.set } : descriptor[key], context);
        if (kind === "accessor") {
            if (result === void 0) continue;
            if (result === null || typeof result !== "object") throw new TypeError("Object expected");
            if (_ = accept(result.get)) descriptor.get = _;
            if (_ = accept(result.set)) descriptor.set = _;
            if (_ = accept(result.init)) initializers.unshift(_);
        }
        else if (_ = accept(result)) {
            if (kind === "field") initializers.unshift(_);
            else descriptor[key] = _;
        }
    }
    if (target) Object.defineProperty(target, contextIn.name, descriptor);
    done = true;
};
var __runInitializers = (this && this.__runInitializers) || function (thisArg, initializers, value) {
    var useValue = arguments.length > 2;
    for (var i = 0; i < initializers.length; i++) {
        value = useValue ? initializers[i].call(thisArg, value) : initializers[i].call(thisArg);
    }
    return useValue ? value : void 0;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __setFunctionName = (this && this.__setFunctionName) || function (f, name, prefix) {
    if (typeof name === "symbol") name = name.description ? "[".concat(name.description, "]") : "";
    return Object.defineProperty(f, "name", { configurable: true, value: prefix ? "".concat(prefix, " ", name) : name });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserService = void 0;
const user_model_1 = __importDefault(require("../../models/user.model"));
const tsyringe_1 = require("tsyringe");
const winston_1 = require("../../lib/winston");
const config_1 = __importDefault(require("../../config"));
const msal_node_1 = require("@azure/msal-node");
const microsoft_graph_client_1 = require("@microsoft/microsoft-graph-client");
let UserService = (() => {
    let _classDecorators = [(0, tsyringe_1.injectable)()];
    let _classDescriptor;
    let _classExtraInitializers = [];
    let _classThis;
    var UserService = _classThis = class {
        constructor() {
            this.config = {
                auth: {
                    clientId: config_1.default.AZURE_CLIENT_ID,
                    clientSecret: config_1.default.AZURE_CLIENT_SECRETE,
                    authority: config_1.default.AZURE_CLIENT_AUTHORITY,
                },
            };
        }
        deleteUserFromEntraId(userId) {
            return __awaiter(this, void 0, void 0, function* () {
                try {
                    if (!userId) {
                        throw new Error('Valid userId is required');
                    }
                    const cca = new msal_node_1.ConfidentialClientApplication(this.config);
                    const result = yield cca.acquireTokenByClientCredential({
                        scopes: ['https://graph.microsoft.com/.default'],
                    });
                    if (!(result === null || result === void 0 ? void 0 : result.accessToken)) {
                        winston_1.logger.error('Failed to acquire Graph token for Entra ID deletion', {
                            userId,
                        });
                        throw new Error('Failed to acquire Graph token');
                    }
                    const client = microsoft_graph_client_1.Client.init({
                        authProvider: (done) => done(null, result.accessToken),
                    });
                    yield client.api(`/users/${userId}`).delete();
                    winston_1.logger.info('User deleted successfully from Entra ID', { userId });
                    return true;
                }
                catch (error) {
                    if (error.statusCode === 404) {
                        winston_1.logger.warn('User not found in Entra ID for deletion', { userId });
                        return false;
                    }
                    winston_1.logger.error('Failed to delete user from Entra ID', { userId, error });
                    throw new Error(`Failed to delete user from Entra ID`);
                }
            });
        }
        deleteUser(userId) {
            return __awaiter(this, void 0, void 0, function* () {
                try {
                    const result = yield user_model_1.default.deleteOne({ userId }).exec();
                    if (result.deletedCount === 0) {
                        winston_1.logger.warn('User not found for deletion', { userId });
                        return false;
                    }
                    winston_1.logger.info('User deleted successfully', { userId });
                    return true;
                }
                catch (error) {
                    winston_1.logger.error('Error deleting user', { userId, error });
                    throw new Error(`Failed to delete user: ${error instanceof Error ? error.message : 'Unknown error'}`);
                }
            });
        }
        updateUser(userId, property, decrement, value) {
            return __awaiter(this, void 0, void 0, function* () {
                try {
                    const update = decrement
                        ? { $inc: { [property]: -1 }, $set: { updatedAt: new Date() } }
                        : { $set: { [property]: value, updatedAt: new Date() } };
                    const result = yield user_model_1.default.updateOne({ userId }, update).exec();
                    if (result.modifiedCount === 0) {
                        winston_1.logger.warn(`User not found or ${property} not updated`, { userId });
                        return false;
                    }
                    winston_1.logger.info(`${property} ${decrement ? 'decremented' : 'updated'} successfully`, { userId, property, value: decrement ? 1 : value });
                    return true;
                }
                catch (error) {
                    winston_1.logger.error(`Error updating ${property}`, { userId, property, error });
                    throw new Error(`Failed to update ${property}: ${error instanceof Error ? error.message : 'Unknown error'}`);
                }
            });
        }
        checkIfUserExist(req) {
            return __awaiter(this, void 0, void 0, function* () {
                const userId = req.userId;
                winston_1.logger.info('user id:', { userId: userId });
                const user = yield user_model_1.default.findOne({ userId }).select('-__v').exec();
                if (!user)
                    return null;
                winston_1.logger.info('user from db', {
                    user: {
                        id: user.userId,
                        email: user.email,
                    },
                });
                return {
                    userId: String(user.userId),
                    plan: user.plan,
                    lengthOfDocs: user.lengthOfDocs,
                    email: user.email,
                };
            });
        }
        createUserFromToken(req) {
            return __awaiter(this, void 0, void 0, function* () {
                const userId = req.userId;
                const email = req.email;
                const username = req.username;
                yield user_model_1.default.create({
                    userId,
                    email: email,
                    username: username,
                });
            });
        }
    };
    __setFunctionName(_classThis, "UserService");
    (() => {
        const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
        UserService = _classThis = _classDescriptor.value;
        if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return UserService = _classThis;
})();
exports.UserService = UserService;
