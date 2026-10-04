import type { RegistrationGateway } from '../features/registration/application/registration-gateway';
import type { ProjectsGateway } from '../features/projects/application/projects-gateway';
import type { AttendanceGateway } from '../features/attendance/application/attendance-gateway';
import type { SocialFormsGateway } from '../features/social-forms/application/social-forms-gateway';
import type { ReportsGateway } from '../features/reports/application/reports-gateway';
import type { AccessGateway } from '../features/access/application/access-gateway';
import type { AuditEntry } from '@erp/contracts/audit';
export interface ErpClient {
  subscribe(listener: () => void): () => void;
  getVersion(): number;
  access: AccessGateway;
  registration: RegistrationGateway;
  projects: ProjectsGateway;
  attendance: AttendanceGateway;
  socialForms: SocialFormsGateway;
  reports: ReportsGateway;
  audit: { list(): Promise<AuditEntry[]> };
}
