export interface OperationIdentity {
  readonly key: string;
  readonly payload: string;
}

/**
 * Binds an idempotency identity to the exact submitted payload. Retrying an
 * identical submission replays instead of duplicating; editing the payload
 * starts a new identity so the user is never stuck behind a conflict for
 * data they already changed. The caller must warn about unknown results
 * before an edited retry, since the first attempt may have persisted.
 */
export function identifyOperation(
  previous: OperationIdentity | null,
  payload: string,
  generateKey: () => string,
): OperationIdentity {
  if (previous !== null && previous.payload === payload) return previous;
  return { key: generateKey(), payload };
}
