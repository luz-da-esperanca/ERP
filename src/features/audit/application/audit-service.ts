import type { Principal } from '../../access/application/ports.js';
import {
  assertPermission,
  capabilitiesFor,
} from '../../access/domain/permissions.js';
import { ResourceNotFoundError } from '../../../core/application/errors.js';
import type { AuditReader, AuditQueryInput } from './audit-reader.js';

export class AuditService {
  constructor(private readonly reader: AuditReader) {}

  private authorize(principal: Principal) {
    assertPermission(
      principal.user.roleCodes,
      principal.user.mustChangePassword,
      'accounts.manage',
    );
    assertPermission(principal.user.roleCodes, false, 'audit.read');
  }

  async list(principal: Principal, input: AuditQueryInput) {
    this.authorize(principal);
    return this.reader.list(input);
  }

  async get(principal: Principal, id: string) {
    if (
      !principal.user.mustChangePassword &&
      !capabilitiesFor(principal.user.roleCodes).includes('accounts.manage')
    )
      throw new ResourceNotFoundError();
    this.authorize(principal);
    const entry = await this.reader.get(id);
    if (!entry) throw new ResourceNotFoundError();
    return entry;
  }
}
