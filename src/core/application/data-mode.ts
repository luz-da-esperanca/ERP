import { FeatureNotEnabledError } from './errors.js';

export type DataMode = 'SYNTHETIC' | 'REAL';
export interface FeatureDecisionReader {
  find(
    code: string,
  ): Promise<{ enabled: boolean; decisionReference: string } | null>;
}

export class DataModeGuard {
  constructor(
    private readonly mode: DataMode,
    private readonly decisions: FeatureDecisionReader,
  ) {}

  async assertEnabled() {
    if (this.mode === 'SYNTHETIC') return;
    const decision = await this.decisions.find('REAL_PERSONAL_DATA');
    if (!decision?.enabled || !decision.decisionReference.trim())
      throw new FeatureNotEnabledError();
  }
}
