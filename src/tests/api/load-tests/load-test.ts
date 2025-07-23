// @ts-nocheck
/// <reference types="k6" />
/**
 * External modules
 */
import http from 'k6/http';
import { sleep, check, abortTest } from 'k6';

export let options = {
  scenarios: {
    load_test: {
      executor: 'ramping-vus',
      stages: [
        { duration: '1m', target: 50 }, // Ramp up to 50 VUs in 1 minute
        { duration: '2m', target: 350 }, // Ramp up to 350 VUs in 2 minutes
        { duration: '2m', target: 0 }, // Ramp down to 0 VUs in 2 minutes
      ],
    },
  },
  thresholds: {
    checks: [{ threshold: 'rate>=1', abortOnFail: true }], // Stop test if any check fails
    http_req_failed: [{ threshold: 'rate==0', abortOnFail: true }], // Stop test if any HTTP request fails
    http_req_duration: ['p(95)<6000'], // 95% of requests under 6s
  },
  throw: true, // Exit with non-zero code (107 for abortTest)
};

const token = __ENV.K6_API_TEST_TOKEN;

// Validate token in setup to fail early
export function setup() {
  if (!token || token === 'undefined') {
    console.log('Error: K6_API_TEST_TOKEN is not set or is undefined');
    abortTest('K6_API_TEST_TOKEN is not set or is undefined');
  }
}

export default function () {
  let res = http.post('http://localhost:3001/api/v1/users', null, {
    headers: { Authorization: `Bearer ${token}` },
  });

  const checkResult = check(res, {
    'is status 200': (r) => r.status === 200,
  });

  if (!checkResult) {
    abortTest(`Request failed with status ${res.status}`);
    console.log(`Error: Request failed with status ${res.status}, response: ${res.body != null ? res.body : 'null'}`);
  }

  console.log(`Status: ${res.status}`);
  console.log(`Response: ${res.body != null ? res.body : 'null'}`);

  sleep(1);
}