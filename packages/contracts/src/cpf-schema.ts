import { z } from 'zod';
import { Cpf, InvalidCpfError } from './cpf';

export const cpfSchema = z.string().transform((input, context) => {
  try {
    return Cpf.parse(input).value;
  } catch (error) {
    if (!(error instanceof InvalidCpfError)) throw error;
    context.addIssue({ code: 'custom', message: 'Invalid CPF' });
    return z.NEVER;
  }
});

export const nullableCpfSchema = z
  .string()
  .trim()
  .transform((value) => value || null)
  .pipe(cpfSchema.nullable())
  .nullable();
