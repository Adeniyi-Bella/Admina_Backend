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
require("reflect-metadata");
require("./di/container");
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const compression_1 = __importDefault(require("compression"));
const helmet_1 = __importDefault(require("helmet"));
const config_1 = __importDefault(require("./config"));
const express_rate_limit_1 = __importDefault(require("./lib/express_rate_limit"));
const mongoose_1 = require("./lib/mongoose");
const winston_1 = require("./lib/winston");
const v1_1 = __importDefault(require("./routes/v1"));
const app = (0, express_1.default)();
const corsOptions = {
    origin(origin, callback) {
        winston_1.logger.info('Origin is:', { originIs: origin });
        if (!origin ||
            config_1.default.WHITELIST_ORIGINS.includes(origin)) {
            callback(null, true);
        }
        else {
            callback(new Error(`CORS error: ${origin} is not allowed by CORS`), false);
            winston_1.logger.warn(`CORS error: ${origin} is not allowed by CORS`);
        }
    },
};
app.use((0, cors_1.default)(corsOptions));
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true }));
app.use((0, cookie_parser_1.default)());
app.use((0, compression_1.default)({
    threshold: 1024,
}));
app.use((0, helmet_1.default)());
app.use(express_rate_limit_1.default);
(() => __awaiter(void 0, void 0, void 0, function* () {
    try {
        yield (0, mongoose_1.connectToDatabase)();
        app.use('/api/v1', v1_1.default);
        app.listen(config_1.default.PORT, () => {
            winston_1.logger.info(`Server running: http://localhost:${config_1.default.PORT}`);
        });
    }
    catch (err) {
        winston_1.logger.error('Failed to start the server', err);
        if (config_1.default.NODE_ENV === 'production' || config_1.default.NODE_ENV === "development") {
            process.exit(1);
        }
    }
}))();
const handleServerShutdown = () => __awaiter(void 0, void 0, void 0, function* () {
    try {
        yield (0, mongoose_1.disconnectFromDatabase)();
        winston_1.logger.warn('Server SHUTDOWN');
        yield winston_1.logtail.flush();
        process.exit(0);
    }
    catch (err) {
        winston_1.logger.error('Error during server shutdown', err);
    }
});
process.on('SIGTERM', handleServerShutdown);
process.on('SIGINT', handleServerShutdown);
