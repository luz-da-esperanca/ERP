export type CatalogEntity = 'Institute' | 'ServiceType';
export type ProjectsEntity =
  CatalogEntity | 'Project' | 'Activity' | 'ParticipantEnrollment';
export type RecordStatus = 'ACTIVE' | 'CLOSED';
export type ActivityNature = 'PERIODIC' | 'ONE_OFF';
export interface CatalogRecord {
  id: string;
  code: string;
  name: string;
  active: boolean;
  revision: number;
}
export interface RecordMetadata {
  id: string;
  revision: number;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy: string;
}
export interface ProjectFields {
  name: string;
  instituteId: string;
  description: string | null;
  startsOn: string | null;
  endsOn: string | null;
}
export interface Project extends ProjectFields, RecordMetadata {
  status: RecordStatus;
  closedAt: string | null;
}
export interface ActivityFields {
  name: string;
  nature: ActivityNature;
  serviceTypeId: string | null;
  plannedSchedule: string | null;
  responsibleId: string | null;
}
export interface Activity extends ActivityFields, RecordMetadata {
  projectId: string;
  status: RecordStatus;
  closedAt: string | null;
}
export interface Enrollment extends RecordMetadata {
  activityId: string;
  personId: string;
  validFrom: string;
  validUntil: string | null;
  supersededById: string | null;
}
export type ProjectsSnapshot = CatalogRecord | Project | Activity | Enrollment;
export interface ProjectClosureResult {
  project: Project;
  activities: Activity[];
  enrollments: Enrollment[];
}
export interface ActivityClosureResult {
  activity: Activity;
  enrollments: Enrollment[];
}
export interface ProjectsResults {
  Institute: CatalogRecord;
  ServiceType: CatalogRecord;
  Project: Project;
  Activity: Activity;
  ParticipantEnrollment: Enrollment;
  ProjectClosure: ProjectClosureResult;
  ActivityClosure: ActivityClosureResult;
}
export type ProjectsResultKind = keyof ProjectsResults;
export interface RevisionReference {
  entityType: ProjectsEntity;
  entityId: string;
  revision: number;
}
export interface ProjectsReference {
  kind: ProjectsResultKind;
  primary: RevisionReference;
  activities: RevisionReference[];
  enrollments: RevisionReference[];
}
export interface PageQuery {
  page: number;
  pageSize: number;
}
export interface CatalogQuery extends PageQuery {
  active?: boolean;
}
export interface ProjectsQuery extends PageQuery {
  q?: string;
  instituteId?: string;
  status?: RecordStatus;
}
export interface ActivitiesQuery extends PageQuery {
  q?: string;
  projectId?: string;
  nature?: ActivityNature;
  status?: RecordStatus;
}
export interface EnrollmentsQuery extends PageQuery {
  asOf?: string;
  personId?: string;
}
export interface Page<T> {
  data: T[];
  pagination: { page: number; pageSize: number; total: number };
}
export interface ParticipantIdentity {
  id: string;
  name: string;
  family: { id: string; code: string } | null;
}
export interface EnrollmentItem {
  enrollment: Enrollment;
  person: ParticipantIdentity;
}
