"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const express_validator_1 = require("express-validator");
const authenticate_1 = __importDefault(require("../../middlewares/authenticate"));
const validationError_1 = __importDefault(require("../../middlewares/validationError"));
const verifyUploadedFile_1 = __importDefault(require("../../middlewares/verifyUploadedFile"));
const resetPropertiesIfNewMonth_1 = __importDefault(require("../../middlewares/resetPropertiesIfNewMonth"));
const getAllDocument_1 = __importDefault(require("../../controllers/document/getAllDocument"));
const getDocument_1 = __importDefault(require("../../controllers/document/getDocument"));
const deleteDocument_1 = __importDefault(require("../../controllers/document/deleteDocument"));
const updateActionPlan_1 = __importDefault(require("../../controllers/document/update-document/updateActionPlan"));
const getDocumentChatbotLimit_1 = __importDefault(require("../../controllers/document/getDocumentChatbotLimit"));
const createDocument_1 = __importDefault(require("../../controllers/document/createDocument"));
const router = (0, express_1.Router)();
const upload = (0, multer_1.default)({
    storage: multer_1.default.memoryStorage(),
    limits: { fileSize: 15 * 1024 * 1024 },
    fileFilter: (_, file, cb) => {
        const allowedFileTypes = [
            'application/pdf',
            'image/png',
            'image/jpeg',
            'image/jpg',
        ];
        if (allowedFileTypes.includes(file.mimetype)) {
            cb(null, true);
        }
        else {
            cb(new Error('Invalid file type. Only PDF, PNG, or JPEG files are allowed.'));
        }
    },
});
router.use(authenticate_1.default);
router.use(resetPropertiesIfNewMonth_1.default);
router.get('/', (0, express_validator_1.query)('limit')
    .optional()
    .isInt({ min: 1, max: 50 })
    .withMessage('Limit must be between 1 to 20'), (0, express_validator_1.query)('offset')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Offset must be a positive integer'), validationError_1.default, getAllDocument_1.default);
router.get('/:docId', (0, express_validator_1.param)('docId').notEmpty().isUUID().withMessage('Invalid doId ID'), validationError_1.default, getDocument_1.default);
router.get('/:docId/limit', (0, express_validator_1.param)('docId').notEmpty().isUUID().withMessage('Invalid doId ID'), validationError_1.default, getDocumentChatbotLimit_1.default);
router.post('/', upload.single('file'), verifyUploadedFile_1.default, (0, express_validator_1.body)('docLanguage')
    .exists()
    .withMessage('Source language is required')
    .isString()
    .withMessage('Source language must be a string')
    .isLength({ min: 2, max: 5 })
    .withMessage('Must be 2–5 characters')
    .matches(/^[a-zA-Z]{2,5}$/)
    .withMessage('Must be a valid language code'), (0, express_validator_1.body)('targetLanguage')
    .exists()
    .withMessage('Target language is required')
    .isString()
    .withMessage('Target language must be a string')
    .isLength({ min: 2, max: 5 })
    .withMessage('Must be 2–5 characters')
    .matches(/^[a-zA-Z]{2,5}$/)
    .withMessage('Must be a valid language code'), validationError_1.default, createDocument_1.default);
router.delete('/:docId', (0, express_validator_1.param)('docId').notEmpty().isUUID().withMessage('Invalid docId ID'), validationError_1.default, deleteDocument_1.default);
router.patch('/actionPlan/:docId', (0, express_validator_1.param)('docId').notEmpty().isUUID().withMessage('Invalid docId'), (0, express_validator_1.query)('type')
    .notEmpty()
    .withMessage('type query parameter is required')
    .isIn(['create'])
    .withMessage('type must be create'), validationError_1.default, updateActionPlan_1.default);
router.patch('/actionPlan/:docId/:id', (0, express_validator_1.param)('docId').notEmpty().isUUID().withMessage('Invalid docId'), (0, express_validator_1.param)('id').notEmpty().isUUID().withMessage('Invalid actionPlan id'), (0, express_validator_1.query)('type')
    .notEmpty()
    .withMessage('type query parameter is required')
    .isIn(['update', 'delete'])
    .withMessage('type must be one of update, or delete'), validationError_1.default, updateActionPlan_1.default);
exports.default = router;
