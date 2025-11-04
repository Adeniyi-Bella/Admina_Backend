"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const api_response_1 = require("../lib/api_response");
const verifyUploadedFile = (req, res, next) => {
    if (!req.file) {
        api_response_1.ApiResponse.badRequest(res, 'No file uploaded. Please include a PDF, PNG, or JPEG file.');
        return;
    }
    next();
};
exports.default = verifyUploadedFile;
