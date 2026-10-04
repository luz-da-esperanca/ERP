import type { Account } from '@erp/contracts/access';
import type {
  Family,
  Person,
  FamilyMembership,
} from '@erp/contracts/registration';
import type {
  Activity,
  Project,
  Institute,
  Enrollment,
  ServiceType,
} from '@erp/contracts/projects';
import type { ActivitySession } from '@erp/contracts/attendance';
import type { SocialForm } from '@erp/contracts/social-forms';
import type { AuditEntry } from '@erp/contracts/audit';

export interface DemoState {
  accounts: Account[];
  families: Family[];
  people: Person[];
  memberships: FamilyMembership[];
  institutes: Institute[];
  serviceTypes: ServiceType[];
  projects: Project[];
  activities: Activity[];
  enrollments: Enrollment[];
  sessions: ActivitySession[];
  socialForms: SocialForm[];
  audit: AuditEntry[];
}
