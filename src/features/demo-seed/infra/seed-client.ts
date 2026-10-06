import { createHash } from 'node:crypto';
import type { z } from 'zod';
import type { ApiConfig } from '../../../core/infra/config.js';
import type { createRuntime } from '../../../runtime.js';
import { ShowcaseSeedError } from './seed-environment.js';

export type SeedRuntime = Awaited<ReturnType<typeof createRuntime>>;

function operationKey(step: string) {
  const bytes = createHash('sha256').update(`showcase:v1:${step}`).digest();
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const value = bytes.subarray(0, 16).toString('hex');
  return `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(16, 20)}-${value.slice(20)}`;
}

export function createSeedClient(
  runtime: SeedRuntime,
  config: ApiConfig,
  cookie: string,
  actorId: string,
) {
  async function request(
    method: 'GET' | 'POST' | 'PATCH',
    url: string,
    payload?: object,
    step?: string,
  ) {
    const response = await runtime.app.inject({
      method,
      url: `/api/v1${url}`,
      payload,
      headers: {
        origin: config.APP_ORIGIN,
        'x-erp-request': '1',
        'content-type': 'application/json',
        cookie,
        ...(step ? { 'idempotency-key': operationKey(step) } : {}),
      },
    });
    if (response.statusCode >= 400) {
      const error = response.json<{
        error?: { code?: string; details?: { rule?: string } };
      }>().error;
      throw new ShowcaseSeedError(
        `Showcase step ${step ?? url} failed (${response.statusCode}, ${error?.code ?? 'UNKNOWN'}, ${error?.details?.rule ?? 'UNKNOWN'})`,
      );
    }
    return response;
  }
  const completed = async (step: string) => {
    const operation = await runtime.database.operationRecord.findFirst({
      where: { key: operationKey(step), completedAt: { not: null } },
      select: {
        actorId: true,
        entries: { select: { entityType: true, entityId: true } },
      },
    });
    if (operation && operation.actorId !== actorId)
      throw new ShowcaseSeedError(
        'Showcase operation belongs to another account',
      );
    return operation;
  };
  async function once(step: string, work: () => Promise<unknown>) {
    // Completed operations survive partial runs; current revisions must not replay old intentions.
    if (!(await completed(step))) await work();
  }
  return {
    async read<T>(url: string, schema: z.ZodType<T>): Promise<T> {
      return schema.parse((await request('GET', url)).json().data);
    },
    write: (
      step: string,
      url: string,
      payload: object,
      method: 'POST' | 'PATCH' = 'POST',
    ) => request(method, url, payload, step),
    once,
    async entity(
      step: string,
      entityType: string,
      work: () => Promise<unknown>,
    ) {
      await once(step, work);
      const entry = (await completed(step))?.entries.find(
        (row) => row.entityType === entityType,
      );
      if (!entry)
        throw new ShowcaseSeedError(
          `Showcase step ${step} has no audited ${entityType}`,
        );
      return entry.entityId;
    },
  };
}
export type SeedClient = ReturnType<typeof createSeedClient>;
