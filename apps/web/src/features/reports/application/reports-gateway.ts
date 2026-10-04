import type { QualityIssue, ReachReport } from '@erp/contracts/reports';
import type { summarizeFrequency } from '../../attendance/domain/frequency';
export interface FrequencyReport extends ReturnType<typeof summarizeFrequency> {
  from: string;
  toExclusive: string;
}
export interface ReportsGateway {
  reach(from: string, toExclusive: string): Promise<ReachReport>;
  frequency(from: string, toExclusive: string): Promise<FrequencyReport>;
  quality(): Promise<QualityIssue[]>;
}
