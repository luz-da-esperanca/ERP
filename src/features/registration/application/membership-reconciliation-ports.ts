import type { RegistrationTransaction } from './registration-ports.js';
import type { AttendanceTransaction } from '../../attendance/application/attendance-ports.js';
import type {
  ReconciliationReference,
  ReconciliationResult,
} from '../domain/membership-reconciliation.js';
export interface ReconciliationPorts {
  registration: RegistrationTransaction;
  attendance: AttendanceTransaction;
  activityIdsForPerson(id: string): Promise<string[]>;
  operation(
    type: string,
    key: string,
  ): Promise<{
    actorId: string | null;
    fingerprint: string;
    reference: ReconciliationReference;
  } | null>;
  completeOperation(
    id: string,
    reference: ReconciliationReference,
  ): Promise<void>;
  restore(reference: ReconciliationReference): Promise<ReconciliationResult>;
}
export interface ReconciliationReader {
  read<T>(work: (ports: ReconciliationPorts) => Promise<T>): Promise<T>;
}
export interface ReconciliationUnitOfWork {
  run<T>(
    actorId: string,
    personId: string,
    familyIds: readonly string[],
    work: (ports: ReconciliationPorts) => Promise<T>,
  ): Promise<T>;
}
