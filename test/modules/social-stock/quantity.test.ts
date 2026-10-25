import { describe, expect, it } from 'vitest';
import { Quantity } from '../../../src/modules/social-stock/domain/quantity.ts';

describe('Exact stock quantities (RF-EST-08 / VAL-05)', () => {
  const kilograms = { id: '01963000-0000-7000-8000-000000000101', precision: 3 };

  it('adds decimal quantities exactly at the explicitly configured unit precision', () => {
    const result = Quantity.parse('0.1', kilograms).add(Quantity.parse('0.2', kilograms));
    expect(result.toString()).toBe('0.300');
    expect(Quantity.parse('9007199254740993.001', kilograms).toString()).toBe('9007199254740993.001');
  });

  it.each(['1.0001', '-1', 'NaN', 'Infinity', '1e3', '1,5', '', ' 1', '01', 0.1, null, '9'.repeat(39)])('rejects invalid or excessive precision without rounding (%j)', (value) => {
    expect(() => Quantity.parse(value, kilograms)).toThrow();
  });

  it('rejects fractions in indivisible units and distinguishes zero allowances', () => {
    const pieces = { id: '01963000-0000-7000-8000-000000000102', precision: 0 };
    expect(() => Quantity.parse('1.1', pieces)).toThrow();
    expect(() => Quantity.parse('0', pieces)).toThrow();
    expect(Quantity.parse('0', pieces, true).toString()).toBe('0');
    expect(Quantity.parse('2', pieces).toString()).toBe('2');
  });

  it('blocks cross-unit addition even when both units have the same precision', () => {
    const boxes = { id: '01963000-0000-7000-8000-000000000103', precision: 3 };
    expect(() => Quantity.parse('1', kilograms).add(Quantity.parse('2', boxes))).toThrow();
    expect(() => Quantity.parse('1', kilograms).add(Quantity.parse('2', { ...kilograms, precision: 0 }))).toThrow();
  });

  it('rejects missing or unsupported unit precision and addition beyond capacity', () => {
    for (const precision of [-1, 1.5, 19, Number.NaN]) {
      expect(() => Quantity.parse('1', { ...kilograms, precision })).toThrow();
    }
    const unit = { ...kilograms, precision: 0 };
    expect(() => Quantity.parse('9'.repeat(38), unit).add(Quantity.parse('1', unit))).toThrow();
  });
});
