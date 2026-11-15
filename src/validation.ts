/** Internal normalized values only. An adapter must bind official field names and
 * timestamp units explicitly; this module does not infer platform encodings. */
export interface TaskEnvelope {
  taskId: string;
  issuedAtMs: number;
  deadlineAtMs: number;
}
export interface EnvelopePolicy {
  nowMs: number;
  maxAgeMs: number;
  maxFutureSkewMs: number;
  maxLifetimeMs: number;
}
const nonnegativeSafe = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 && !Object.is(value, -0);

/** Decimal JSON integers only, up to 78 digits. This is a parsing/resource bound,
 * not an assertion that the value fits any platform field, scalar or uint256. */
export function parseNonnegativeInteger(value: unknown): bigint {
  if (nonnegativeSafe(value)) return BigInt(value);
  if (typeof value === 'string' && value.length <= 78 && /^(0|[1-9][0-9]*)$/.test(value)) return BigInt(value);
  throw Error('INVALID_NONNEGATIVE_INTEGER');
}

/** Requires a deadline strictly after now and issuance, with a bounded total
 * lifetime. Policy is explicit so deployment choices cannot masquerade as protocol. */
export function validateEnvelope(value: unknown, policy: EnvelopePolicy): TaskEnvelope {
  if (!policy || ![policy.nowMs, policy.maxAgeMs, policy.maxFutureSkewMs, policy.maxLifetimeMs].every(nonnegativeSafe) || policy.maxLifetimeMs === 0) {
    throw Error('INVALID_ENVELOPE_POLICY');
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error('INVALID_ENVELOPE');
  const {taskId, issuedAtMs, deadlineAtMs} = value as Record<string, unknown>;
  if (typeof taskId !== 'string' || taskId.length === 0 || taskId.trim() !== taskId ||
    Buffer.byteLength(taskId) > 1024 || /[\u0000-\u001f\u007f]/.test(taskId) ||
    !nonnegativeSafe(issuedAtMs) || !nonnegativeSafe(deadlineAtMs)) throw Error('INVALID_ENVELOPE');
  if (policy.nowMs - issuedAtMs > policy.maxAgeMs || issuedAtMs - policy.nowMs > policy.maxFutureSkewMs) throw Error('INVALID_ISSUED_AT');
  if (deadlineAtMs <= policy.nowMs || deadlineAtMs <= issuedAtMs ||
    deadlineAtMs - issuedAtMs > policy.maxLifetimeMs || deadlineAtMs - policy.nowMs > policy.maxLifetimeMs) throw Error('INVALID_DEADLINE');
  return {taskId, issuedAtMs, deadlineAtMs};
}
