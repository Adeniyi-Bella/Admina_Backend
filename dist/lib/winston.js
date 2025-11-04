"use strict";
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logtail = exports.logger = void 0;
const winston_1 = __importDefault(require("winston"));
const node_1 = require("@logtail/node");
const winston_2 = require("@logtail/winston");
const config_1 = __importDefault(require("../config"));
const { combine, timestamp, json, errors, align, printf, colorize } = winston_1.default.format;
const transports = [];
const logtail = new node_1.Logtail(config_1.default.LOGTAIL_SOURCE_TOKEN, {
    endpoint: `https://${config_1.default.LOG_TAIL_INGESTING_HOST}`,
});
exports.logtail = logtail;
if (config_1.default.NODE_ENV === 'local') {
    transports.push(new winston_1.default.transports.Console({
        format: combine(colorize({ all: true }), timestamp({ format: 'YYYY-MM-DD hh:mm:ss A' }), align(), printf((_a) => {
            var { timestamp, level, message } = _a, meta = __rest(_a, ["timestamp", "level", "message"]);
            const metaStr = Object.keys(meta).length
                ? `\n${JSON.stringify(meta)}`
                : '';
            return `${timestamp} [${level}]: ${message}${metaStr}`;
        })),
    }));
}
else {
    transports.push(new winston_1.default.transports.Console({
        format: combine(timestamp(), json()),
    }));
    if (!config_1.default.LOGTAIL_SOURCE_TOKEN || !config_1.default.LOG_TAIL_INGESTING_HOST) {
        throw new Error('Logtail source token and ingesting host must be provided in the configuration');
    }
    transports.push(new winston_2.LogtailTransport(logtail));
}
const logger = winston_1.default.createLogger({
    level: config_1.default.LOG_LEVEL || 'info',
    format: combine(timestamp(), errors({ stack: true }), json()),
    transports,
    silent: config_1.default.NODE_ENV === 'test',
});
exports.logger = logger;
