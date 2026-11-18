// Run with Node 24: node --test tests/allowedOrigin.test.mjs
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isAllowedOrigin } from '../server/src/setup/allowedOrigin.ts';

const rules = { podHostname: 'eight-pod' };

test('every name and address the Pod is opened under is allowed', () => {
  const allowedOrigins = [
    undefined,
    'http://192.168.1.50:3000',
    'http://10.1.2.3:3000',
    'http://192.168.1.20:3000',
    'http://172.20.0.4:3000',
    'http://localhost:5173',
    'http://eight-pod:3000',
    'http://eight-pod.local:3000',
    'http://EIGHT-POD.local:3000',
    'http://100.64.0.5:3000',
    'https://eight-pod.tail1234.ts.net',
  ];
  for (const origin of allowedOrigins) assert.equal(isAllowedOrigin(origin, rules), true, String(origin));
});

test('pages elsewhere are refused', () => {
  const refusedOrigins = [
    'https://example.com',
    'http://192.168.1.50.example.com:3000',
    'http://eight-pod.example.com:3000',
    'http://other-device.local:3000',
    'http://other-device.tail1234.ts.net',
    'http://8.8.8.8:3000',
    'http://100.128.0.1:3000',
    'http://172.32.0.1:3000',
    'not a url',
  ];
  for (const origin of refusedOrigins) assert.equal(isAllowedOrigin(origin, rules), false, origin);
});

test('ALLOWED_ORIGIN adds a prefix or opens everything', () => {
  assert.equal(isAllowedOrigin('https://bed.example.com', { ...rules, extraAllowedOrigin: 'https://bed.example.com' }), true);
  assert.equal(isAllowedOrigin('https://example.com', { ...rules, extraAllowedOrigin: '*' }), true);
});
