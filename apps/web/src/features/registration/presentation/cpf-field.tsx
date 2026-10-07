import type { FormEvent } from 'react';
import { formatCpfInput } from '@erp/contracts/cpf';
import { Field } from '../../../shared/ui';

export function CpfField({ defaultValue }: { defaultValue?: string | null }) {
  function applyMask(event: FormEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const digitsBeforeCursor = input.value
      .slice(0, input.selectionStart ?? input.value.length)
      .replace(/\D/g, '').length;
    input.value = formatCpfInput(input.value);
    let cursor = 0;
    let digitCount = 0;
    while (cursor < input.value.length && digitCount < digitsBeforeCursor) {
      if (/\d/.test(input.value[cursor]!)) digitCount++;
      cursor++;
    }
    input.setSelectionRange(cursor, cursor);
  }
  return (
    <Field
      label="CPF"
      name="cpf"
      inputMode="numeric"
      maxLength={14}
      pattern="[0-9]{3}\.[0-9]{3}\.[0-9]{3}-[0-9]{2}"
      placeholder="000.000.000-00"
      defaultValue={formatCpfInput(defaultValue ?? '')}
      onInput={applyMask}
    />
  );
}
