/** Парс числа с запятой/точкой; NaN если пусто/бито. */
export function parseNum(raw: string): number {
  return Number.parseFloat(raw.replace(',', '.'))
}

/** Нормализует денежную границу фильтра; null означает некорректное значение. */
export function normalizeAmountFilter(raw: string): string | null {
  const value = raw.trim()
  if (value === '') return ''
  if (!/^\d+(?:[.,]\d{1,2})?$/.test(value)) return null
  const normalized = value.replace(',', '.')
  const number = Number(normalized)
  return Number.isFinite(number) && number >= 0 ? normalized : null
}