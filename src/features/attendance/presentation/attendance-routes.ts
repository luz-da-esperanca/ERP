import { z } from 'zod';
import type { FastifyInstance } from 'fastify';
import type { AttendanceService } from '../application/attendance-service.js';
import type { AuthenticateRequest } from '../../../core/presentation/authenticate-request.js';
import {
  attendanceContextQuerySchema,
  attendanceContextSchema,
  createSessionSchema,
  sessionResultSchema,
  sessionDetailSchema,
  sessionsQuerySchema,
  sessionsPageSchema,
  frequencyQuerySchema,
  frequencyResultSchema,
  updateAttendanceSchema,
  cancellationSchema,
  coverageViewSchema,
  coverageDtoSchema,
  periodQuerySchema,
  coverageDeclarationSchema,
  sessionCorrectionSchema,
  contextCorrectionSchema,
} from '@erp/contracts/attendance-api';

export function registerAttendanceRoutes(
  app: FastifyInstance,
  attendance: AttendanceService,
  principal: AuthenticateRequest,
) {
  const params = z.object({ id: z.uuid() }).strict();
  app.patch('/api/v1/sessions/:id', async (request) => {
    const actor = await principal(request, 'attendance.write');
    return {
      data: sessionResultSchema.parse(
        await attendance.correctSession(
          { actor, key: z.uuid().parse(request.headers['idempotency-key']) },
          params.parse(request.params).id,
          sessionCorrectionSchema.parse(request.body),
        ),
      ),
    };
  });
  app.post('/api/v1/attendances/:id/context-corrections', async (request) => {
    const actor = await principal(request, 'attendance.write');
    return {
      data: sessionResultSchema.parse(
        await attendance.correctContext(
          { actor, key: z.uuid().parse(request.headers['idempotency-key']) },
          params.parse(request.params).id,
          contextCorrectionSchema.parse(request.body),
        ),
      ),
    };
  });
  app.get('/api/v1/activities/:id/coverage', async (request) => {
    const actor = await principal(request, 'attendance.read');
    return {
      data: coverageViewSchema.parse(
        await attendance.coverage(
          actor,
          params.parse(request.params).id,
          periodQuerySchema.parse(request.query),
        ),
      ),
    };
  });
  app.post(
    '/api/v1/activities/:id/coverage-declarations',
    async (request, reply) => {
      const actor = await principal(request, 'attendance.write');
      return reply.code(201).send({
        data: coverageDtoSchema.parse(
          await attendance.declareCoverage(
            {
              actor,
              key: z.uuid().parse(request.headers['idempotency-key']),
            },
            params.parse(request.params).id,
            coverageDeclarationSchema.parse(request.body),
          ),
        ),
      });
    },
  );
  app.put('/api/v1/sessions/:id/attendance', async (request) => {
    const actor = await principal(request, 'attendance.write');
    return {
      data: sessionResultSchema.parse(
        await attendance.updateAttendance(
          { actor, key: z.uuid().parse(request.headers['idempotency-key']) },
          params.parse(request.params).id,
          updateAttendanceSchema.parse(request.body),
        ),
      ),
    };
  });
  app.post('/api/v1/sessions/:id/cancellation', async (request) => {
    const actor = await principal(request, 'attendance.write');
    return {
      data: sessionResultSchema.parse(
        await attendance.cancelSession(
          { actor, key: z.uuid().parse(request.headers['idempotency-key']) },
          params.parse(request.params).id,
          cancellationSchema.parse(request.body),
        ),
      ),
    };
  });
  app.get('/api/v1/activities/:id/attendance-context', async (request) => ({
    data: attendanceContextSchema.parse(
      await attendance.context(
        await principal(request, 'attendance.read'),
        params.parse(request.params).id,
        attendanceContextQuerySchema.parse(request.query),
      ),
    ),
  }));
  app.post('/api/v1/activities/:id/sessions', async (request, reply) => {
    const actor = await principal(request, 'attendance.write');
    const result = await attendance.createSession(
      { actor, key: z.uuid().parse(request.headers['idempotency-key']) },
      params.parse(request.params).id,
      createSessionSchema.parse(request.body),
    );
    return reply.code(201).send({ data: sessionResultSchema.parse(result) });
  });
  app.get('/api/v1/sessions/:id', async (request) => {
    const actor = await principal(request, 'attendance.read');
    z.object({}).strict().parse(request.query);
    return {
      data: sessionDetailSchema.parse(
        await attendance.session(actor, params.parse(request.params).id),
      ),
    };
  });
  app.get('/api/v1/activities/:id/sessions', async (request) =>
    sessionsPageSchema.parse(
      await attendance.sessions(
        await principal(request, 'attendance.read'),
        params.parse(request.params).id,
        sessionsQuerySchema.parse(request.query),
      ),
    ),
  );
  app.get('/api/v1/people/:id/frequency', async (request) => {
    const actor = await principal(request, 'attendance.read');
    return {
      data: frequencyResultSchema.parse(
        await attendance.frequency(actor, {
          personId: params.parse(request.params).id,
          ...frequencyQuerySchema.parse(request.query),
        }),
      ),
    };
  });
}
