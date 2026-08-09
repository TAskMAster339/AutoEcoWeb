export function displayAlias(
  aliasName: string | null | undefined,
  normalized: string | null | undefined,
  source: string | null | undefined,
): string {
  return aliasName || normalized || source || '—'
}

