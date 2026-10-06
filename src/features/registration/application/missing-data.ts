import { missingFields } from '../domain/missing-data-rules.js';
import type { RegistrationEntity } from '../domain/duplicate-rules.js';
import type { MissingDataTransaction } from './missing-data-ports.js';

export async function reconcileMissingData(
  tx: MissingDataTransaction,
  operationId: string,
  actorId: string,
  entityType: RegistrationEntity,
  entityId: string,
  fields: object,
) {
  const selection = await tx.selection();
  const selected =
    (entityType === 'PERSON'
      ? selection?.personFields
      : selection?.familyFields) ?? [];
  const missing = new Set(missingFields(selected, fields));
  const open = await tx.openIssues(entityType, entityId);
  for (const issue of open) {
    const key = issue.fieldKeys[0];
    if (key && !missing.has(key))
      await tx.closeIssue(
        operationId,
        actorId,
        issue,
        selected.includes(key) ? 'COMPLETED' : 'NOT_TRACKED',
      );
  }
  for (const key of missing)
    if (!open.some((issue) => issue.fieldKeys[0] === key))
      await tx.createIssue(operationId, actorId, entityType, entityId, key);
}
