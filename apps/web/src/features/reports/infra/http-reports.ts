import { z } from 'zod';
import {
  historyQuerySchema,
  historySchema,
  reachReportQuerySchema,
  reachReportSchema,
  reachRecordsQuerySchema,
  reachRecordsSchema,
  frequencyReportQuerySchema,
  frequencyReportSchema,
  frequencyRecordsQuerySchema,
  frequencyRecordsSchema,
  eligibilityReportQuerySchema,
  eligibilityReportSchema,
  eligibilityRecordsQuerySchema,
  eligibilityRecordsSchema,
  qualityReportQuerySchema,
  qualityReportSchema,
  qualityRecordsQuerySchema,
  qualityRecordsSchema,
} from '@erp/contracts/reports-api';
import type { ApiClient } from '../../../shared/api-client';
import { apiQuery } from '../../../shared/api-query';

export class HttpReports {
  constructor(private readonly api: ApiClient) {}

  readonly reach = async (query: z.input<typeof reachReportQuerySchema>) => {
    const { data } = await this.api.request(
      apiQuery('/reports/reach', reachReportQuerySchema.parse(query)),
      z.object({ data: reachReportSchema }),
    );
    return data;
  };

  readonly reachRecords = async (
    query: z.input<typeof reachRecordsQuerySchema>,
  ) =>
    this.api.request(
      apiQuery('/reports/reach/records', reachRecordsQuerySchema.parse(query)),
      reachRecordsSchema,
    );

  readonly frequency = async (
    query: z.input<typeof frequencyReportQuerySchema>,
  ) => {
    const { data } = await this.api.request(
      apiQuery('/reports/frequency', frequencyReportQuerySchema.parse(query)),
      z.object({ data: frequencyReportSchema }),
    );
    return data;
  };

  readonly frequencyRecords = async (
    query: z.input<typeof frequencyRecordsQuerySchema>,
  ) =>
    this.api.request(
      apiQuery(
        '/reports/frequency/records',
        frequencyRecordsQuerySchema.parse(query),
      ),
      frequencyRecordsSchema,
    );

  readonly eligibility = async (
    query: z.input<typeof eligibilityReportQuerySchema>,
  ) => {
    const { data } = await this.api.request(
      apiQuery(
        '/reports/eligibility',
        eligibilityReportQuerySchema.parse(query),
      ),
      z.object({ data: eligibilityReportSchema }),
    );
    return data;
  };

  readonly eligibilityRecords = async (
    query: z.input<typeof eligibilityRecordsQuerySchema>,
  ) =>
    this.api.request(
      apiQuery(
        '/reports/eligibility/records',
        eligibilityRecordsQuerySchema.parse(query),
      ),
      eligibilityRecordsSchema,
    );

  readonly quality = async (
    query: z.input<typeof qualityReportQuerySchema>,
  ) => {
    const { data } = await this.api.request(
      apiQuery('/reports/data-quality', qualityReportQuerySchema.parse(query)),
      z.object({ data: qualityReportSchema }),
    );
    return data;
  };

  readonly qualityRecords = async (
    query: z.input<typeof qualityRecordsQuerySchema>,
  ) =>
    this.api.request(
      apiQuery(
        '/reports/data-quality/records',
        qualityRecordsQuerySchema.parse(query),
      ),
      qualityRecordsSchema,
    );
  familyHistory(id: string, query: z.input<typeof historyQuerySchema> = {}) {
    return this.api.request(
      apiQuery(
        `/families/${z.uuid().parse(id)}/history`,
        historyQuerySchema.parse(query),
      ),
      historySchema,
    );
  }
  personHistory(id: string, query: z.input<typeof historyQuerySchema> = {}) {
    return this.api.request(
      apiQuery(
        `/people/${z.uuid().parse(id)}/history`,
        historyQuerySchema.parse(query),
      ),
      historySchema,
    );
  }
}
