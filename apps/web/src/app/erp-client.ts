import type { RegistrationGateway } from '../features/registration/application/registration-gateway';
import type { ProjectsGateway } from '../features/projects/application/projects-gateway';
import type { AttendanceGateway } from '../features/attendance/application/attendance-gateway';
import type { SocialFormsGateway } from '../features/social-forms/application/social-forms-gateway';
import type { ReportsGateway } from '../features/reports/application/reports-gateway';
import type { AccessGateway } from '../features/access/application/access-gateway';
import type { AuditEntry } from '@erp/contracts/audit';
import type { Family, FamilyInput } from '@erp/contracts/registration';
import type { CreateFamilyInput } from '@erp/contracts/registration-api';
import type { DuplicateCandidate } from '../features/registration/application/registration-gateway';

export interface ErpViewClient {
  subscribe(listener: () => void): () => void;
  getVersion(): number;
  access?: AccessGateway;
  registration: Pick<
    RegistrationGateway,
    'listFamilies' | 'getFamily' | 'listPeople' | 'getPerson'
  > & {
    createFamily(
      input: FamilyInput & Pick<CreateFamilyInput, 'duplicateReview'>,
      operationKey: string,
    ): Promise<Family>;
    updateFamily(
      id: string,
      revision: number,
      input: FamilyInput,
      operationKey: string,
    ): Promise<Family>;
    reviewFamilyDuplicates?(input: FamilyInput): Promise<DuplicateCandidate[]>;
  };
  projects: Pick<ProjectsGateway, 'overview' | 'getActivity'>;
  audit: { list(familyId?: string): Promise<AuditEntry[]> };
}
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
