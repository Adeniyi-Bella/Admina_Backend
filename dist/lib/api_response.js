"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApiResponse = void 0;
class ApiResponse {
    static base(res, httpCode, status, code, message, data) {
        return res.status(httpCode).json({
            status,
            code,
            message,
            data,
            timestamp: new Date().toISOString(),
            version: this.version,
        });
    }
    static ok(res, message, data) {
        return this.base(res, 200, 'ok', 'OK', message, data);
    }
    static created(res, message, data) {
        return this.base(res, 201, 'ok', 'CREATED', message, data);
    }
    static noContent(res) {
        return res.status(204).send();
    }
    static badRequest(res, message, error) {
        return this.base(res, 400, 'error', 'BAD_REQUEST', message, error);
    }
    static unauthorized(res, message) {
        return this.base(res, 401, 'error', 'UNAUTHORIZED', message);
    }
    static notFound(res, message) {
        return this.base(res, 404, 'error', 'NOT_FOUND', message);
    }
    static serverError(res, message, error) {
        return this.base(res, 500, 'error', 'SERVER_ERROR', message, error);
    }
}
exports.ApiResponse = ApiResponse;
ApiResponse.version = '1.0.0';
