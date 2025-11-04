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
exports.DocumentService = void 0;
const document_model_1 = __importDefault(require("../../models/document.model"));
const tsyringe_1 = require("tsyringe");
const uuid_1 = require("uuid");
const winston_1 = require("../../lib/winston");
let DocumentService = (() => {
    let _classDecorators = [(0, tsyringe_1.injectable)()];
    let _classDescriptor;
    let _classExtraInitializers = [];
    let _classThis;
    var DocumentService = _classThis = class {
        deleteAllDocuments(userId) {
            return __awaiter(this, void 0, void 0, function* () {
                try {
                    const result = yield document_model_1.default.deleteMany({ userId }).exec();
                    if (result.deletedCount === 0) {
                        winston_1.logger.info('No documents found for deletion', { userId });
                    }
                    winston_1.logger.info('All documents deleted successfully', {
                        userId,
                        deletedCount: result.deletedCount,
                    });
                    return true;
                }
                catch (error) {
                    winston_1.logger.error('Failed to delete all documents', { userId, error });
                    throw new Error(`Failed to delete all documents: ${error instanceof Error ? error.message : 'Unknown error'}`);
                }
            });
        }
        getAllDocumentsByUserId(user, limit, offset) {
            return __awaiter(this, void 0, void 0, function* () {
                if (!user.userId) {
                    throw new Error('Valid userId is required');
                }
                const userId = user.userId;
                const total = yield document_model_1.default.countDocuments({ userId });
                const documents = yield document_model_1.default.find({ userId })
                    .sort({ createdAt: 1 })
                    .select('-__v')
                    .limit(limit)
                    .skip(offset)
                    .lean()
                    .exec();
                return { total, documents };
            });
        }
        createDocumentByUserId(document) {
            return __awaiter(this, void 0, void 0, function* () {
                try {
                    if (!document || !document.userId || !document.docId) {
                        throw new Error('Valid document data is required');
                    }
                    const createdDocument = yield document_model_1.default.create(document);
                    const result = yield document_model_1.default.findById(createdDocument._id)
                        .select('-__v')
                        .lean()
                        .exec();
                    if (!result) {
                        throw new Error('Failed to retrieve created document');
                    }
                    return result;
                }
                catch (error) {
                    winston_1.logger.error('Failed to create document', { error: error });
                    throw new Error(`Failed to create document: ${error}`);
                }
            });
        }
        getDocument(user, docId) {
            return __awaiter(this, void 0, void 0, function* () {
                if (!user.userId || !docId) {
                    throw new Error('Valid userId and docId are required');
                }
                const document = yield document_model_1.default.findOne({ userId: user.userId, docId })
                    .select('-__v')
                    .exec();
                if (!document) {
                    return null;
                }
                return document;
            });
        }
        deleteDocument(userId, docId) {
            return __awaiter(this, void 0, void 0, function* () {
                try {
                    if (!userId || !docId) {
                        throw new Error('Valid userId and docId are required');
                    }
                    const result = yield document_model_1.default.deleteOne({ userId, docId }).exec();
                    if (result.deletedCount === 0) {
                        winston_1.logger.info('Document not found for deletion', { userId, docId });
                        return false;
                    }
                    winston_1.logger.info('Document deleted successfully', { userId, docId });
                    return true;
                }
                catch (error) {
                    winston_1.logger.error('Failed to delete document', { userId, docId, error });
                    throw new Error(`Failed to delete document: ${error instanceof Error ? error.message : error}`);
                }
            });
        }
        updateDocument(userId, docId, updates) {
            return __awaiter(this, void 0, void 0, function* () {
                try {
                    if (!userId || !docId) {
                        throw new Error('Valid userId and docId are required');
                    }
                    if (!updates || Object.keys(updates).length === 0) {
                        throw new Error('Valid update data is required');
                    }
                    const updateQuery = '$inc' in updates
                        ? Object.assign(Object.assign({}, updates), { $set: { updatedAt: new Date() } }) : { $set: Object.assign(Object.assign({}, updates), { updatedAt: new Date() }) };
                    const updatedDocument = yield document_model_1.default.findOneAndUpdate({ userId, docId }, updateQuery, { new: true, runValidators: true, select: '-__v' })
                        .lean()
                        .exec();
                    if (!updatedDocument) {
                        winston_1.logger.info('Document not found for update', { userId, docId });
                        return null;
                    }
                    return updatedDocument;
                }
                catch (error) {
                    winston_1.logger.error('Failed to update document', {
                        userId,
                        docId,
                        updates,
                        error,
                    });
                    throw new Error(`Failed to update document: ${error instanceof Error ? error.message : error}`);
                }
            });
        }
        updateActionPlan(userId, docId, action, actionPlanData, actionPlanId) {
            return __awaiter(this, void 0, void 0, function* () {
                var _a;
                try {
                    if (!userId || !docId) {
                        throw new Error('Valid userId and docId are required');
                    }
                    let update = {};
                    let options = {};
                    if (action === 'create') {
                        if (!actionPlanData || !actionPlanData.title) {
                            throw new Error('Title is required for creating an action plan');
                        }
                        const newActionPlan = {
                            id: (0, uuid_1.v4)(),
                            title: actionPlanData.title,
                            dueDate: actionPlanData.dueDate
                                ? new Date(actionPlanData.dueDate)
                                : new Date(),
                            completed: false,
                            location: (_a = actionPlanData.location) !== null && _a !== void 0 ? _a : '',
                        };
                        update = {
                            $push: { actionPlans: newActionPlan },
                            $set: { updatedAt: new Date() },
                        };
                    }
                    else if (action === 'delete') {
                        if (!actionPlanId) {
                            throw new Error('Action plan ID is required for deletion');
                        }
                        const document = yield document_model_1.default.findOne({
                            userId,
                            docId,
                            'actionPlans.id': actionPlanId,
                        }).exec();
                        if (!document) {
                            winston_1.logger.info('Document or action plan not found for deletion', {
                                userId,
                                docId,
                                actionPlanId,
                            });
                            return null;
                        }
                        update = {
                            $pull: { actionPlans: { id: actionPlanId } },
                            $set: { updatedAt: new Date() },
                        };
                    }
                    else if (action === 'update') {
                        if (!actionPlanId) {
                            throw new Error('Action plan ID is required for update');
                        }
                        const document = yield document_model_1.default.findOne({
                            userId,
                            docId,
                            'actionPlans.id': actionPlanId,
                        }).exec();
                        if (!document) {
                            winston_1.logger.info('Document or action plan not found for update', {
                                userId,
                                docId,
                                actionPlanId,
                            });
                            return null;
                        }
                        if (!actionPlanData ||
                            (!actionPlanData.title &&
                                !actionPlanData.dueDate &&
                                actionPlanData.completed === undefined &&
                                !actionPlanData.location)) {
                            throw new Error('At least one field (title, dueDate, completed, location) must be provided for update');
                        }
                        const updateFields = {};
                        if (actionPlanData.title)
                            updateFields['actionPlans.$[elem].title'] = actionPlanData.title;
                        if (actionPlanData.dueDate)
                            updateFields['actionPlans.$[elem].dueDate'] = new Date(actionPlanData.dueDate);
                        if (actionPlanData.completed !== undefined)
                            updateFields['actionPlans.$[elem].completed'] =
                                actionPlanData.completed;
                        if (actionPlanData.location)
                            updateFields['actionPlans.$[elem].location'] =
                                actionPlanData.location;
                        updateFields['updatedAt'] = new Date();
                        update = { $set: updateFields };
                        options = { arrayFilters: [{ 'elem.id': actionPlanId }] };
                    }
                    else {
                        throw new Error('Invalid action type. Must be "create", "delete", or "update"');
                    }
                    const updatedDocument = yield document_model_1.default.findOneAndUpdate({ userId, docId }, update, Object.assign({ new: true, runValidators: true, select: '-__v' }, options))
                        .lean()
                        .exec();
                    if (!updatedDocument) {
                        winston_1.logger.info('Document not found for action plan update', {
                            userId,
                            docId,
                            action,
                        });
                        return null;
                    }
                    winston_1.logger.info('Action plan updated successfully', {
                        userId,
                        docId,
                        action,
                    });
                    return updatedDocument;
                }
                catch (error) {
                    winston_1.logger.error('Failed to update action plan', {
                        error,
                    });
                    throw new Error(`Failed to update action plan: ${error instanceof Error ? error.message : error}`);
                }
            });
        }
    };
    __setFunctionName(_classThis, "DocumentService");
    (() => {
        const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
        DocumentService = _classThis = _classDescriptor.value;
        if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return DocumentService = _classThis;
})();
exports.DocumentService = DocumentService;
