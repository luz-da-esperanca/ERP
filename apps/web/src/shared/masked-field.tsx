import type { InputEvent, InputHTMLAttributes } from 'react';
import { Field } from './ui';

type InputMask = 'phone' | 'postalCode' | 'currency';

function formatInput(value: string, mask: InputMask) {
  if (mask === 'currency') {
    const digits = value
      .replace(/\D/g, '')
      .replace(/^0+(?=\d)/, '')
      .slice(0, 14);
    if (!digits) return '';
    const padded = digits.padStart(3, '0');
    const integer = new Intl.NumberFormat('pt-BR').format(
      BigInt(padded.slice(0, -2)),
    );
    return `${integer},${padded.slice(-2)}`;
  }
  if (mask === 'postalCode') {
    const digits = value.replace(/\D/g, '').slice(0, 8);
    return digits.length > 5
      ? `${digits.slice(0, 5)}-${digits.slice(5)}`
      : digits;
  }
  if (mask === 'phone') {
    const digits = value.replace(/\D/g, '').slice(0, 11);
    if (!digits) return '';
    if (digits.length <= 2) return `(${digits}`;
    const split = digits.length > 10 ? 7 : 6;
    return `(${digits.slice(0, 2)}) ${digits.slice(2, split)}${digits.length > split ? `-${digits.slice(split)}` : ''}`;
  }
  return value;
}

export function MaskedField({
  mask,
  defaultValue,
  onInput,
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'value'> & {
  mask: InputMask;
  label: string;
  name: string;
}) {
  function applyMask(event: InputEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const digitsAfterCursor = input.value
      .slice(input.selectionStart ?? input.value.length)
      .replace(/\D/g, '').length;
    const digitsBeforeCursor = input.value
      .slice(0, input.selectionStart ?? input.value.length)
      .replace(/\D/g, '').length;
    input.value = formatInput(input.value, mask);
    if (mask === 'currency') {
      let cursor = input.value.length;
      let digitCount = 0;
      while (cursor > 0 && digitCount < digitsAfterCursor) {
        cursor--;
        if (/\d/.test(input.value[cursor]!)) digitCount++;
      }
      input.setSelectionRange(cursor, cursor);
      onInput?.(event);
      return;
    }
    let cursor = 0;
    let digitCount = 0;
    while (cursor < input.value.length && digitCount < digitsBeforeCursor) {
      if (/\d/.test(input.value[cursor]!)) digitCount++;
      cursor++;
    }
    input.setSelectionRange(cursor, cursor);
    onInput?.(event);
  }
  return (
    <Field
      {...props}
      inputMode="numeric"
      autoComplete={
        mask === 'phone'
          ? 'tel-national'
          : mask === 'postalCode'
            ? 'postal-code'
            : 'off'
      }
      pattern={
        mask === 'phone'
          ? '\\([0-9]{2}\\) [0-9]{4,5}-[0-9]{4}'
          : mask === 'postalCode'
            ? '[0-9]{5}-[0-9]{3}'
            : '[0-9]{1,3}(\\.[0-9]{3})*,[0-9]{2}'
      }
      placeholder={
        mask === 'phone'
          ? '(00) 00000-0000'
          : mask === 'postalCode'
            ? '00000-000'
            : '0,00'
      }
      defaultValue={formatInput(String(defaultValue ?? ''), mask)}
      onInput={applyMask}
    />
  );
}
