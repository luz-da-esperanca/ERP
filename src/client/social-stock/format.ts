export const UNKNOWN_LABEL = 'Não informado';

export function formatCode(code: string | null): string {
  return code ?? UNKNOWN_LABEL;
}

export function formatPrecision(precision: number | null): string {
  if (precision === null) return UNKNOWN_LABEL;
  if (precision === 0) return 'Indivisível';
  if (precision === 1) return '1 casa decimal';
  return `${precision} casas decimais`;
}
