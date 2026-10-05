import type { FeatureDecisionReader } from '../application/data-mode.js';
import { databaseOperation, type Database } from './database.js';

export class PrismaFeatureDecisions implements FeatureDecisionReader {
  constructor(private readonly database: Database) {}
  find(code: string) {
    return databaseOperation(() =>
      this.database.featureDecision.findUnique({
        where: { code },
        select: { enabled: true, decisionReference: true },
      }),
    );
  }
}
