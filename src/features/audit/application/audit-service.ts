import type { Principal } from '../../access/application/ports.js';
import {
  assertPermission,
  capabilitiesFor,
} from '../../access/domain/permissions.js';
import { ResourceNotFoundError } from '../../../core/application/errors.js';
import type { AuditReader, AuditQueryInput } from './audit-reader.js';
import type { AuditEntity } from '../domain/audit-entry.js';

export class AuditService {
  constructor(private readonly reader: AuditReader) {}

  private authorize(
    principal: Principal,
    entityType: AuditEntity = 'UserAccount',
  ) {
    assertPermission(
      principal.user.roleCodes,
      principal.user.mustChangePassword,
      entityType === 'UserAccount'
        ? 'accounts.manage'
        : [
              'Institute',
              'ServiceType',
              'Project',
              'Activity',
              'ParticipantEnrollment',
            ].includes(entityType)
          ? 'projects.read'
          : 'registration.read',
    );
    assertPermission(principal.user.roleCodes, false, 'audit.read');
  }

  async list(principal: Principal, input: AuditQueryInput) {
    this.authorize(principal, input.entityType);
    return this.reader.list(input);
  }

  async get(principal: Principal, id: string) {
    const capabilities = capabilitiesFor(principal.user.roleCodes);
    const entityTypes: AuditEntity[] = [];
    if (capabilities.includes('accounts.manage'))
      entityTypes.push('UserAccount');
    if (capabilities.includes('registration.read'))
      entityTypes.push(
        'Family',
        'Person',
        'FamilyMembership',
        'SizeProfile',
        'DataQualityIssue',
      );
    if (capabilities.includes('projects.read'))
      entityTypes.push(
        'Institute',
        'ServiceType',
        'Project',
        'Activity',
        'ParticipantEnrollment',
      );
    if (!principal.user.mustChangePassword && !entityTypes.length)
      throw new ResourceNotFoundError();
    assertPermission(
      principal.user.roleCodes,
      principal.user.mustChangePassword,
      'audit.read',
    );
    const entry = await this.reader.get(id, entityTypes);
    if (!entry) throw new ResourceNotFoundError();
    return entry;
  }
}
