import type { AuditTrailPort, IdempotencyPort } from './audit-and-idempotency.ts';

export interface MutationContext<Repository> {
  readonly repository: Repository;
  readonly auditTrail: AuditTrailPort;
  readonly idempotency: IdempotencyPort;
}

export type TransactionRunner<Context> = <Result>(
  work: (context: Context) => Promise<Result>,
) => Promise<Result>;
