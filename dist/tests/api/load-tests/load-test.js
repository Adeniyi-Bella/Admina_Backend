"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.options = void 0;
exports.setup = setup;
exports.default = default_1;
const http_1 = __importDefault(require("k6/http"));
const k6_1 = require("k6");
exports.options = {
    scenarios: {
        load_test: {
            executor: 'ramping-vus',
            stages: [
                { duration: '1m', target: 50 },
                { duration: '2m', target: 350 },
                { duration: '2m', target: 0 },
            ],
        },
    },
    thresholds: {
        checks: [{ threshold: 'rate>=1', abortOnFail: true }],
        http_req_failed: [{ threshold: 'rate==0', abortOnFail: true }],
        http_req_duration: ['p(95)<6000'],
    },
    throw: true,
};
const token = __ENV.K6_API_TEST_TOKEN;
function setup() {
    if (!token || token === 'undefined') {
        console.log('Error: K6_API_TEST_TOKEN is not set or is undefined');
        (0, k6_1.abortTest)('K6_API_TEST_TOKEN is not set or is undefined');
    }
}
function default_1() {
    let res = http_1.default.post('http://localhost:3001/api/v1/users', null, {
        headers: { Authorization: `Bearer ${token}` },
    });
    const checkResult = (0, k6_1.check)(res, {
        'is status 200': (r) => r.status === 200,
    });
    if (!checkResult) {
        (0, k6_1.abortTest)(`Request failed with status ${res.status}`);
        console.log(`Error: Request failed with status ${res.status}, response: ${res.body != null ? res.body : 'null'}`);
    }
    console.log(`Status: ${res.status}`);
    console.log(`Response: ${res.body != null ? res.body : 'null'}`);
    (0, k6_1.sleep)(1);
}
