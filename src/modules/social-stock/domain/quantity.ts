import { validationFailedError } from '../../shared/errors.ts';

// Technical representation limits, not approved institutional unit settings (LAC-06).
export const MAX_QUANTITY_DIGITS = 38;
export const MAX_UNIT_PRECISION = 18;

export interface QuantityUnit {
  readonly id: string;
  readonly precision: number;
}

export class Quantity {
  private readonly atoms: bigint;
  private readonly unit: QuantityUnit;

  private constructor(atoms: bigint, unit: QuantityUnit) {
    this.atoms = atoms;
    this.unit = unit;
  }

  static parse(value: unknown, unit: QuantityUnit, canBeZero = false): Quantity {
    if (!Number.isInteger(unit.precision) || unit.precision < 0 || unit.precision > MAX_UNIT_PRECISION) {
      throw quantityError('INVALID_UNIT_PRECISION', 'A precisão da unidade deve ser informada e estar na capacidade suportada.');
    }
    if (typeof value !== 'string' || value.length > MAX_QUANTITY_DIGITS + 1 || !/^(0|[1-9]\d*)(\.\d+)?$/.test(value)) {
      throw quantityError('INVALID_QUANTITY', 'Informe a quantidade como texto decimal positivo, sem conversão ou arredondamento.');
    }
    const [whole = '0', fraction = ''] = value.split('.');
    if (fraction.length > unit.precision) {
      throw quantityError('EXCESS_PRECISION', 'A quantidade excede a precisão da unidade.');
    }
    const atoms = BigInt(whole + fraction.padEnd(unit.precision, '0'));
    if (!canBeZero && atoms === 0n) throw quantityError('INVALID_QUANTITY', 'A quantidade deve ser positiva.');
    return Quantity.fromAtoms(atoms, unit);
  }

  add(other: Quantity): Quantity {
    if (this.unit.id !== other.unit.id || this.unit.precision !== other.unit.precision) {
      throw quantityError('UNIT_MISMATCH', 'Quantidades de unidades diferentes não podem ser somadas sem regra explícita.');
    }
    return Quantity.fromAtoms(this.atoms + other.atoms, this.unit);
  }

  private static fromAtoms(atoms: bigint, unit: QuantityUnit): Quantity {
    if (atoms.toString().length > MAX_QUANTITY_DIGITS) {
      throw quantityError('QUANTITY_OVERFLOW', 'A quantidade excede a capacidade suportada.');
    }
    return new Quantity(atoms, { ...unit });
  }

  toString(): string {
    const digits = this.atoms.toString().padStart(this.unit.precision + 1, '0');
    return this.unit.precision === 0 ? digits : `${digits.slice(0, -this.unit.precision)}.${digits.slice(-this.unit.precision)}`;
  }
}

function quantityError(code: string, message: string) {
  return validationFailedError([{ field: 'quantity', code, message }]);
}
