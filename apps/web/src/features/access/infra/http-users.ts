import { z } from 'zod';
import {
  createUserSchema,
  resetPasswordSchema,
  activationSchema,
  listUsersSchema,
  updateUserSchema,
  userDtoSchema,
  usersPageSchema,
} from '@erp/contracts/access-api';
import type {
  ResetPasswordInput,
  CreateUserInput,
  UpdateUserInput,
  ActivationInput,
} from '@erp/contracts/access-api';
import type { ApiClient } from '../../../shared/api-client';
import { apiQuery } from '../../../shared/api-query';

export class HttpUsers {
  constructor(
    private readonly api: ApiClient,
    private readonly onChange = () => {},
  ) {}

  list(query: z.input<typeof listUsersSchema> = {}) {
    return this.api.request(
      apiQuery('/users', listUsersSchema.parse(query)),
      usersPageSchema,
    );
  }

  async create(input: CreateUserInput, key: string) {
    const { data } = await this.api.request(
      '/users',
      z.object({ data: userDtoSchema }),
      {
        method: 'POST',
        body: createUserSchema.parse(input),
        idempotencyKey: key,
      },
    );
    this.onChange();
    return data;
  }

  async update(id: string, input: UpdateUserInput, key: string) {
    const { data } = await this.api.request(
      `/users/${z.uuid().parse(id)}`,
      z.object({ data: userDtoSchema }),
      {
        method: 'PATCH',
        body: updateUserSchema.parse(input),
        idempotencyKey: key,
      },
    );
    this.onChange();
    return data;
  }

  async activate(id: string, input: ActivationInput, key: string) {
    const { data } = await this.api.request(
      `/users/${z.uuid().parse(id)}/activation`,
      z.object({ data: userDtoSchema }),
      {
        method: 'POST',
        body: activationSchema.parse(input),
        idempotencyKey: key,
      },
    );
    this.onChange();
    return data;
  }
  async resetPassword(id: string, input: ResetPasswordInput, key: string) {
    const { data } = await this.api.request(
      `/users/${z.uuid().parse(id)}/password`,
      z.object({ data: userDtoSchema }),
      {
        method: 'PUT',
        body: resetPasswordSchema.parse(input),
        idempotencyKey: key,
      },
    );
    this.onChange();
    return data;
  }
}
