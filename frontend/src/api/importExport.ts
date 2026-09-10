/**
 * Импорт/экспорт данных (универсальный формат: Дата | Категория | Магазин |
 * Описание | Доход | Расход). Парсинг и валидация — на бэкенде; фронт только
 * загружает файл, показывает предпросмотр и отправляет подтверждённые строки.
 */

import { api } from './client'

export interface ImportRowPreview {
  row_number: number
  date: string | null
  category: string | null
  store: string | null
  description: string
  quantity: string | null
  unit: string | null
  price: string | null
  comment: string | null
  income: string
  expense: string
  operation_kind: 'income' | 'expense'
  errors: string[]
  duplicate: 'file' | 'existing' | null
  duplicate_of: number | null
}

export interface ImportPreview {
  rows: ImportRowPreview[]
  total: number
  valid: number
  invalid: number
  duplicates: number
}

export interface ImportRowIn {
  date: string
  category: string | null
  store: string | null
  description: string
  quantity: string | null
  unit: string | null
  price: string | null
  comment: string | null
  income: string
  expense: string
  operation_kind: 'income' | 'expense'
  allow_duplicate?: boolean
}

export interface ImportResult {
  imported: number
  skipped: number
  errors: string[]
  tags_created: string[]
}

/** Разобрать файл на бэкенде и вернуть строки предпросмотра (без записи). */
export async function previewImport(file: File): Promise<ImportPreview> {
  const form = new FormData()
  form.append('file', file)
  return api.upload<ImportPreview>('/api/v1/import-export/preview', form)
}

/** Импортировать подтверждённые строки (авто-создание тегов, bulk-insert). */
export async function runImport(rows: ImportRowIn[]): Promise<ImportResult> {
  return api.post<ImportResult>('/api/v1/import-export/import', { rows })
}

export type ExportLayout = 'single' | 'monthly'

/** Скачать все транзакции в .xlsx: один лист или лист на месяц. */
export async function downloadExport(layout: ExportLayout): Promise<void> {
  const blob = await api.blob(`/api/v1/import-export/export?layout=${layout}`)
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `autoeco-export-${new Date().toISOString().slice(0, 10)}.xlsx`
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
