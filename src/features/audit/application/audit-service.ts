import { auditScopes, auditScope } from '../domain/audit-scopes.js';
import type { Principal } from '../../access/application/ports.js';
import {
  assertPermission,
  capabilitiesFor,
} from '../../access/domain/permissions.js';
import { ResourceNotFoundError } from '../../../core/application/errors.js';
import type { AuditReader, AuditQueryInput } from './audit-reader.js';
import type { AuditEntity, AuditEntry } from '../domain/audit-entry.js';

export class AuditService {
  constructor(
    private readonly reader: AuditReader,
    private readonly socialProjection?: (
      actor: Principal,
      entry: AuditEntry,
    ) => Promise<AuditEntry | null>,
  ) {}
  private project(actor: Principal, entry: AuditEntry) {
    return ['SOCIAL_FORMS', 'FEATURE_DECISIONS'].includes(entry.classification)
      ? this.socialProjection
        ? this.socialProjection(actor, entry)
        : Promise.resolve(null)
      : Promise.resolve(entry);
  }

  private authorize(
    principal: Principal,
    entityType: AuditEntity = 'UserAccount',
  ) {
    assertPermission(
      principal.user.roleCodes,
      principal.user.mustChangePassword,
      auditScope(entityType).capability,
    );
    assertPermission(principal.user.roleCodes, false, 'audit.read');
  }

  async list(principal: Principal, input: AuditQueryInput) {
    this.authorize(principal, input.entityType);
    return this.reader.list(
      input,
      ['SOCIAL_FORMS', 'FEATURE_DECISIONS'].includes(
        auditScope(input.entityType).classification,
      )
        ? (entry) => this.project(principal, entry)
        : undefined,
    );
  }

  async get(principal: Principal, id: string) {
    const capabilities = capabilitiesFor(principal.user.roleCodes);
    const entityTypes = auditScopes
      .filter((scope) => capabilities.includes(scope.capability))
      .flatMap((scope) => scope.entities);
    if (!principal.user.mustChangePassword && !entityTypes.length)
      throw new ResourceNotFoundError();
    assertPermission(
      principal.user.roleCodes,
      principal.user.mustChangePassword,
      'audit.read',
    );
    const entry = await this.reader.get(id, entityTypes, (entry) =>
      this.project(principal, entry),
    );
    if (!entry) throw new ResourceNotFoundError();
    return entry;
  }
}
