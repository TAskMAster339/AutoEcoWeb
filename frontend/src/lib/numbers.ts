/** Парс числа с запятой/точкой; NaN если пусто/бито. */
export function parseNum(raw: string): number {
  return Number.parseFloat(raw.replace(',', '.'))
}