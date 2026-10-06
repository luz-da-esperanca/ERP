export function missingFields(
  selected: readonly string[],
  values: object,
): string[] {
  const fields = values as Record<string, unknown>;
  return selected
    .filter(
      (key) =>
        fields[key] === null ||
        fields[key] === undefined ||
        (typeof fields[key] === 'string' && fields[key].trim() === ''),
    )
    .sort();
}
