import { describe, expect, it } from 'vitest';
import { Cpf } from '../src/cpf';

describe('CPF value object', () => {
  it('normalizes formatted input and compares identity by digits', () => {
    const cpf = Cpf.parse('123.456.789-09');
    expect(cpf.value).toBe('12345678909');
    expect(cpf.format()).toBe('123.456.789-09');
    expect(cpf.equals(Cpf.parse('12345678909'))).toBe(true);
    expect(Object.isFrozen(cpf)).toBe(true);
  });

  it.each([
    '12345678900',
    '11111111111',
    '00000000000',
    '123',
    '123.456.789-0X',
  ])('rejects invalid CPF %s', (value) => {
    expect(() => Cpf.parse(value)).toThrow('Invalid CPF');
  });
});
