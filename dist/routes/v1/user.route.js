"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const authenticate_1 = __importDefault(require("../../middlewares/authenticate"));
const validationError_1 = __importDefault(require("../../middlewares/validationError"));
const create_user_1 = __importDefault(require("../../controllers/user/create_user"));
const getAllDocument_1 = __importDefault(require("../../controllers/document/getAllDocument"));
const resetPropertiesIfNewMonth_1 = __importDefault(require("../../middlewares/resetPropertiesIfNewMonth"));
const upgradeUserPlan_1 = __importDefault(require("../../controllers/user/upgradeUserPlan"));
const downgradeUserPlan_1 = __importDefault(require("../../controllers/user/downgradeUserPlan"));
const deleteUser_1 = __importDefault(require("../../controllers/user/deleteUser"));
const express_validator_1 = require("express-validator");
const getUserDetails_1 = __importDefault(require("../../controllers/user/getUserDetails"));
const router = (0, express_1.Router)();
router.use(authenticate_1.default);
router.post('/', validationError_1.default, create_user_1.default, getAllDocument_1.default);
router.patch('/plan/upgrade/:plan', (0, express_validator_1.param)('plan')
    .isString()
    .withMessage('Invalid plan. Plan must be a string.')
    .notEmpty()
    .withMessage('Invalid plan. Plan must not be empty.')
    .isLength({ min: 7, max: 8 })
    .withMessage('Invalid plan. Plan must be between 7 and 8 characters long.')
    .isIn(['premium', 'standard'])
    .withMessage('Invalid plan. Plan must be one of the following: premium, standard.'), validationError_1.default, resetPropertiesIfNewMonth_1.default, upgradeUserPlan_1.default);
router.patch('/plan/downgrade/:plan', (0, express_validator_1.param)('plan')
    .isString()
    .withMessage('Invalid plan. Plan must be a string.')
    .notEmpty()
    .withMessage('Invalid plan. Plan must not be empty.')
    .isLength({ min: 4, max: 8 })
    .withMessage('Invalid plan. Plan must be between 4 and 8 characters long.')
    .isIn(['free', 'standard'])
    .withMessage('Invalid plan. Plan must be one of the following: free, standard.'), validationError_1.default, resetPropertiesIfNewMonth_1.default, downgradeUserPlan_1.default);
router.get("/", validationError_1.default, resetPropertiesIfNewMonth_1.default, getUserDetails_1.default);
router.delete('/', resetPropertiesIfNewMonth_1.default, deleteUser_1.default);
exports.default = router;
