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
exports.AzureBlobService = void 0;
const tsyringe_1 = require("tsyringe");
const storage_blob_1 = require("@azure/storage-blob");
const stream_1 = require("stream");
const config_1 = __importDefault(require("../../../config"));
const winston_1 = require("../../../lib/winston");
let AzureBlobService = (() => {
    let _classDecorators = [(0, tsyringe_1.injectable)()];
    let _classDescriptor;
    let _classExtraInitializers = [];
    let _classThis;
    var AzureBlobService = _classThis = class {
        constructor() {
            const connectionString = config_1.default.AZURE_STORAGE_ACCOUNT_CONNECTION_STRING;
            this.blobServiceClient =
                storage_blob_1.BlobServiceClient.fromConnectionString(connectionString);
        }
        uploadPdfToBlob(containerName, file, blobName) {
            return __awaiter(this, void 0, void 0, function* () {
                try {
                    const containerClient = this.blobServiceClient.getContainerClient(containerName);
                    yield containerClient.createIfNotExists({ access: 'container' });
                    const blockBlobClient = containerClient.getBlockBlobClient(blobName);
                    yield blockBlobClient.uploadData(file.buffer, {
                        blobHTTPHeaders: { blobContentType: 'application/pdf' },
                    });
                    winston_1.logger.info('Uploaded PDF to Azure Blob Storage', {
                        containerName,
                        blobName,
                    });
                }
                catch (error) {
                    winston_1.logger.error('Error uploading PDF to blob', {
                        containerName,
                        blobName,
                        error: error.message,
                    });
                    throw new Error('Failed to upload PDF to blob');
                }
            });
        }
        downloadPdfFromBlob(containerName, blobName) {
            return __awaiter(this, void 0, void 0, function* () {
                try {
                    const containerClient = this.blobServiceClient.getContainerClient(containerName);
                    const blockBlobClient = containerClient.getBlockBlobClient(blobName);
                    const downloadResponse = yield blockBlobClient.download();
                    const buffer = yield this.streamToBuffer(downloadResponse.readableStreamBody);
                    return {
                        fieldname: 'file',
                        originalname: `${blobName}`,
                        encoding: '7bit',
                        mimetype: 'application/pdf',
                        size: buffer.length,
                        buffer,
                        stream: stream_1.Readable.from(buffer),
                        destination: '',
                        filename: '',
                        path: '',
                    };
                }
                catch (error) {
                    winston_1.logger.error('Error downloading PDF from blob', {
                        containerName,
                        blobName,
                        error: error.message,
                    });
                    throw new Error('Internal server error');
                }
            });
        }
        deleteBlob(containerName, blobName) {
            return __awaiter(this, void 0, void 0, function* () {
                try {
                    const containerClient = this.blobServiceClient.getContainerClient(containerName);
                    yield containerClient.deleteBlob(blobName);
                    winston_1.logger.info('Deleted blob from container', {
                        containerName,
                        blobName,
                    });
                }
                catch (error) {
                    winston_1.logger.error('Failed to delete blob', {
                        containerName,
                        blobName,
                        error: error.message,
                    });
                }
            });
        }
        streamToBuffer(readableStream) {
            return __awaiter(this, void 0, void 0, function* () {
                return new Promise((resolve, reject) => {
                    const chunks = [];
                    readableStream.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
                    readableStream.on('end', () => resolve(Buffer.concat(chunks)));
                    readableStream.on('error', reject);
                });
            });
        }
    };
    __setFunctionName(_classThis, "AzureBlobService");
    (() => {
        const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
        AzureBlobService = _classThis = _classDescriptor.value;
        if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return AzureBlobService = _classThis;
})();
exports.AzureBlobService = AzureBlobService;
