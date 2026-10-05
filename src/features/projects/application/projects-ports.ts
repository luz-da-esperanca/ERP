import type { Principal } from '../../access/application/ports.js';
import type {
  CatalogEntity,
  CatalogQuery,
  CatalogRecord,
  ProjectsEntity,
  ProjectsSnapshot,
  ProjectsReference,
  ProjectsResultKind,
  ProjectsResults,
} from '../domain/projects.js';
import type {
  Project,
  ProjectFields,
  Activity,
  ActivityFields,
  Enrollment,
  ProjectsQuery,
  ActivitiesQuery,
  Page,
} from '../domain/projects.js';
import type { EnrollmentsQuery, EnrollmentItem } from '../domain/projects.js';

export interface ProjectsTransaction {
  findActor(id: string): Promise<Principal | null>;
  findOperation(
    type: string,
    key: string,
  ): Promise<{
    actorId: string | null;
    fingerprint: string;
    reference: ProjectsReference;
  } | null>;
  createOperation(
    type: string,
    key: string,
    actorId: string,
    fingerprint: string,
  ): Promise<string>;
  completeOperation(id: string, reference: ProjectsReference): Promise<void>;
  restore<K extends ProjectsResultKind>(
    reference: ProjectsReference & { kind: K },
  ): Promise<ProjectsResults[K]>;
  findCatalog(entity: CatalogEntity, id: string): Promise<CatalogRecord | null>;
  findServiceTypeByCode(code: string): Promise<CatalogRecord | null>;
  createServiceType(input: {
    code: string;
    name: string;
  }): Promise<CatalogRecord>;
  updateCatalog(
    entity: CatalogEntity,
    id: string,
    changes: { name?: string; active?: boolean },
  ): Promise<CatalogRecord>;
  findProject(id: string): Promise<Project | null>;
  createProject(input: ProjectFields, actorId: string): Promise<Project>;
  updateProject(
    id: string,
    changes: Partial<ProjectFields> & { status?: 'CLOSED'; closedAt?: string },
    actorId: string,
  ): Promise<Project>;
  findActivity(id: string, targetProjectId?: string): Promise<Activity | null>;
  createActivity(
    projectId: string,
    input: ActivityFields,
    actorId: string,
  ): Promise<Activity>;
  updateActivity(
    id: string,
    changes: Partial<ActivityFields> & {
      projectId?: string;
      status?: 'CLOSED';
      closedAt?: string;
    },
    actorId: string,
  ): Promise<Activity>;
  projectActivities(id: string): Promise<Activity[]>;
  activityEnrollments(id: string): Promise<Enrollment[]>;
  accountExists(id: string): Promise<boolean>;
  personExists(id: string): Promise<boolean>;
  hasFamilyMembership(personId: string, at: string): Promise<boolean>;
  findEnrollment(id: string): Promise<Enrollment | null>;
  createEnrollment(
    input: {
      activityId: string;
      personId: string;
      validFrom: string;
      validUntil: string | null;
    },
    actorId: string,
  ): Promise<Enrollment>;
  updateEnrollment(
    id: string,
    changes: { validFrom?: string; validUntil?: string | null },
    actorId: string,
  ): Promise<Enrollment>;
  appendAudit(input: {
    operationId: string;
    actorId: string;
    entityType: ProjectsEntity;
    before: ProjectsSnapshot | null;
    after: ProjectsSnapshot;
    action: 'CREATE' | 'UPDATE' | 'CLOSE' | 'CORRECT';
    reason?: string;
    occurredAt?: string;
  }): Promise<void>;
}
export interface ProjectsUnitOfWork {
  run<T>(
    actorId: string,
    work: (tx: ProjectsTransaction) => Promise<T>,
  ): Promise<T>;
}
export interface ProjectsReader {
  catalogs(
    entity: CatalogEntity,
    query: CatalogQuery,
  ): Promise<Page<CatalogRecord>>;
  projects(query: ProjectsQuery): Promise<Page<Project>>;
  activities(query: ActivitiesQuery): Promise<Page<Activity>>;
  project(
    id: string,
  ): Promise<{ project: Project; activities: Activity[] } | null>;
  activity(
    id: string,
    asOf: string,
  ): Promise<{
    activity: Activity;
    project: Project;
    asOf: string;
    participantCount: number;
  } | null>;
  enrollments(
    activityId: string,
    query: EnrollmentsQuery,
  ): Promise<Page<EnrollmentItem> | null>;
}
