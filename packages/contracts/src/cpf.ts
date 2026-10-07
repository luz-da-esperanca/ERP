export class InvalidCpfError extends Error {
  constructor() {
    super('Invalid CPF');
  }
}

export function formatCpfInput(input: string): string {
  return input
    .replace(/\D/g, '')
    .slice(0, 11)
    .replace(/^(\d{3})(\d)/, '$1.$2')
    .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/^(\d{3})\.(\d{3})\.(\d{3})(\d)/, '$1.$2.$3-$4');
}

export class Cpf {
  private constructor(readonly value: string) {
    Object.freeze(this);
  }

  static parse(input: string): Cpf {
    const text = input.trim();
    if (!/^(?:\d{11}|\d{3}\.\d{3}\.\d{3}-\d{2})$/.test(text))
      throw new InvalidCpfError();
    const value = text.replace(/[.-]/g, '');
    if (/^(\d)\1{10}$/.test(value)) throw new InvalidCpfError();
    for (const length of [9, 10]) {
      const sum = [...value.slice(0, length)].reduce(
        (total, digit, index) => total + Number(digit) * (length + 1 - index),
        0,
      );
      const remainder = sum % 11;
      const expected = remainder < 2 ? 0 : 11 - remainder;
      if (Number(value[length]) !== expected) throw new InvalidCpfError();
    }
    return new Cpf(value);
  }

  equals(other: Cpf): boolean {
    return this.value === other.value;
  }

  format(): string {
    return formatCpfInput(this.value);
  }
}
