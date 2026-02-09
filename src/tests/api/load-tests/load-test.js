// @ts-nocheck
/// <reference types="k6" />
import http from 'k6/http';
import { sleep, check, abortTest } from 'k6';

export let options = {
  scenarios: {
    load_test: {
      executor: 'ramping-vus',
      stages: [
        { duration: '1m', target: 20 },
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

export function setup() {
  console.log('[Setup] Load test setup completed');
}

export default function () {
  const url = 'http://localhost:8080/api/v1/users';
  let res;

  const params = {
    headers: {
      "Authorization": 'Bearer ..--..GQN9I2v_KRsQTFpt_--JO2-',
      'Content-Type': 'application/json',
    },
  };


  try {
    res = http.get(url, params);

    const statusCheck = check(res, {
      'status is 200': (r) => r.status === 200,
    });

    // Try parsing JSON safely
    let parsedBody;
    try {
      parsedBody = res.body ? JSON.parse(res.body) : null;
    } catch (err) {
      console.warn(`[JSON Parse Warning] Failed to parse response body: ${err.message}`);
      parsedBody = res.body;
    }

    if (!statusCheck) {
      if (res.status === 429) {
        console.warn(`[Rate Limit] Status: ${res.status}, Response: ${res.body}`);
        // Optionally, just skip aborting for 429 so test continues
      } else {
        console.error(`[Request Error] Status: ${res.status}, Response: ${res.body}`);
        abortTest(`Request failed with status ${res.status}`);
      }
    } else {
      console.log(`[Request Success] Status: ${res.status}, Response: ${JSON.stringify(parsedBody)}`);
    }
  } catch (err) {
    console.error(`[Exception] Request to ${url} failed: ${err.message}`);
    abortTest(`Request threw an exception: ${err.message}`);
  }

  sleep(1);
}
