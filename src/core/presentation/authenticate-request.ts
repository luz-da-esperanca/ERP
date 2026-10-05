import type { FastifyRequest } from 'fastify';
import type { Capability } from '@erp/contracts/access';
import type { Principal } from '../../features/access/application/ports.js';

export type AuthenticateRequest = (
  request: FastifyRequest,
  capability?: Capability,
) => Promise<Principal>;
