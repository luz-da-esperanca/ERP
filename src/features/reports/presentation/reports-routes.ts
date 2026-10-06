import { z } from 'zod';
import type { FastifyInstance } from 'fastify';
import type { AuthenticateRequest } from '../../../core/presentation/authenticate-request.js';
import {
  eligibilityRecordsQuerySchema,
  eligibilityRecordsSchema,
  eligibilityReportQuerySchema,
  eligibilityReportSchema,
  frequencyRecordsQuerySchema,
  frequencyRecordsSchema,
  frequencyReportQuerySchema,
  frequencyReportSchema,
  historyQuerySchema,
  historySchema,
  qualityRecordsQuerySchema,
  qualityRecordsSchema,
  qualityReportQuerySchema,
  qualityReportSchema,
  reachRecordsQuerySchema,
  reachRecordsSchema,
  reachReportQuerySchema,
  reachReportSchema,
} from '@erp/contracts/reports-api';
import type { ReportsService } from '../application/reports-service.js';

export function registerReportsRoutes(
  app: FastifyInstance,
  reports: ReportsService,
  principal: AuthenticateRequest,
) {
  const params = z.object({ id: z.uuid() }).strict();
  // Each query adds its domain permission inside the service; reports.read alone grants nothing.
  const actor = (request: Parameters<AuthenticateRequest>[0]) =>
    principal(request, 'reports.read');
  app.get('/api/v1/reports/reach', async (request) => ({
    data: reachReportSchema.parse(
      await reports.reach(
        await actor(request),
        reachReportQuerySchema.parse(request.query),
      ),
    ),
  }));
  app.get('/api/v1/reports/reach/records', async (request) =>
    reachRecordsSchema.parse(
      await reports.reachRecords(
        await actor(request),
        reachRecordsQuerySchema.parse(request.query),
      ),
    ),
  );
  app.get('/api/v1/reports/frequency', async (request) => ({
    data: frequencyReportSchema.parse(
      await reports.frequency(
        await actor(request),
        frequencyReportQuerySchema.parse(request.query),
      ),
    ),
  }));
  app.get('/api/v1/reports/frequency/records', async (request) =>
    frequencyRecordsSchema.parse(
      await reports.frequencyRecords(
        await actor(request),
        frequencyRecordsQuerySchema.parse(request.query),
      ),
    ),
  );
  app.get('/api/v1/reports/eligibility', async (request) => ({
    data: eligibilityReportSchema.parse(
      await reports.eligibility(
        await actor(request),
        eligibilityReportQuerySchema.parse(request.query),
      ),
    ),
  }));
  app.get('/api/v1/reports/eligibility/records', async (request) =>
    eligibilityRecordsSchema.parse(
      await reports.eligibilityRecords(
        await actor(request),
        eligibilityRecordsQuerySchema.parse(request.query),
      ),
    ),
  );
  app.get('/api/v1/reports/data-quality', async (request) => ({
    data: qualityReportSchema.parse(
      await reports.dataQuality(
        await actor(request),
        qualityReportQuerySchema.parse(request.query),
      ),
    ),
  }));
  app.get('/api/v1/reports/data-quality/records', async (request) =>
    qualityRecordsSchema.parse(
      await reports.dataQualityRecords(
        await actor(request),
        qualityRecordsQuerySchema.parse(request.query),
      ),
    ),
  );
  app.get('/api/v1/families/:id/history', async (request) =>
    historySchema.parse(
      await reports.familyHistory(
        await actor(request),
        params.parse(request.params).id,
        historyQuerySchema.parse(request.query),
      ),
    ),
  );
  app.get('/api/v1/people/:id/history', async (request) =>
    historySchema.parse(
      await reports.personHistory(
        await actor(request),
        params.parse(request.params).id,
        historyQuerySchema.parse(request.query),
      ),
    ),
  );
}
