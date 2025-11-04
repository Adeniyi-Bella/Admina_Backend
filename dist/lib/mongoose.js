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
exports.disconnectFromDatabase = exports.connectToDatabase = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const config_1 = __importDefault(require("../config"));
const winston_1 = require("../lib/winston");
const clientOptions = {
    dbName: 'Admina-Api',
    appName: 'Admina-Api',
    serverApi: {
        version: '1',
        strict: true,
        deprecationErrors: true,
    },
};
const connectToDatabase = () => __awaiter(void 0, void 0, void 0, function* () {
    if (!config_1.default.MONGO_URI) {
        throw new Error('MongoDB URI is not defined in the configuration.');
    }
    try {
        yield mongoose_1.default.connect(config_1.default.MONGO_URI, clientOptions);
        winston_1.logger.info('Connected to the database successfully.', {
            uri: config_1.default.MONGO_URI,
            options: clientOptions,
        });
    }
    catch (err) {
        if (err instanceof Error) {
            throw err;
        }
        winston_1.logger.error('Error connecting to the database', err);
    }
});
exports.connectToDatabase = connectToDatabase;
const disconnectFromDatabase = () => __awaiter(void 0, void 0, void 0, function* () {
    try {
        yield mongoose_1.default.disconnect();
        winston_1.logger.info('Disconnected from the database successfully.', {
            uri: config_1.default.MONGO_URI,
            options: clientOptions,
        });
    }
    catch (err) {
        if (err instanceof Error) {
            throw new Error(err.message);
        }
        winston_1.logger.error('Error disconnecting from the database', err);
    }
});
exports.disconnectFromDatabase = disconnectFromDatabase;
