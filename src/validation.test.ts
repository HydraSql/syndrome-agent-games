import test from 'node:test';
import assert from 'node:assert/strict';
import {parseNonnegativeInteger, validateEnvelope} from './validation.js';

const policy = {nowMs: 1_000_000, maxAgeMs: 300_000, maxFutureSkewMs: 30_000, maxLifetimeMs: 600_000};
const envelope = {taskId: 'task-1', issuedAtMs: 999_000, deadlineAtMs: 1_001_000};

test('normalized envelope enforces freshness, future skew and bounded lifetime', () => {
  assert.deepEqual(validateEnvelope(envelope, policy), envelope);
  assert.deepEqual(validateEnvelope({...envelope, issuedAtMs: 700_000}, policy), {...envelope, issuedAtMs: 700_000});
  for (const value of [null, [], {}, {...envelope, taskId: ''}, {...envelope, taskId: ' '.repeat(2)},
    {...envelope, taskId: 'x'.repeat(1025)}, {...envelope, issuedAtMs: 699_999},
    {...envelope, issuedAtMs: 1_030_001}, {...envelope, deadlineAtMs: 1_000_000},
    {...envelope, deadlineAtMs: 1_600_001}, {...envelope, issuedAtMs: 1_002_000},
    {...envelope, deadlineAtMs: '1001000'}, {...envelope, issuedAtMs: NaN},
    {...envelope, deadlineAtMs: Infinity}, {...envelope, issuedAtMs: -1}]) {
    assert.throws(() => validateEnvelope(value, policy));
  }
  assert.throws(() => validateEnvelope(envelope, {...policy, maxLifetimeMs: -1}));
});

test('nonnegative integers never coerce ambiguous strings or unsafe numbers', () => {
  assert.equal(parseNonnegativeInteger(0), 0n);
  assert.equal(parseNonnegativeInteger('12345678901234567890'), 12345678901234567890n);
  for (const value of [-0, -1, 1.1, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1, true, null,
    '', ' 1', '1 ', '+1', '-0', '01', '1e3', '0x10', '1.0', '9'.repeat(79), 1n]) {
    assert.throws(() => parseNonnegativeInteger(value), /INVALID_NONNEGATIVE_INTEGER/);
  }
});
