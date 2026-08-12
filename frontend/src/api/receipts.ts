/**
 * Receipts domain API — real endpoints, mirrors backend OpenAPI
 * (backend/src/api/v1/receipts.py, schemas/receipt.py).
 *
 * Чек — «коробка» транзакций (receipt_id на каждой транзакции).
 * Транзакции приходят внутри ReceiptResponse.transactions.
 */
import { api } from './client'
import type {
    CursorPage,
    Receipt,
    ReceiptQrDraft,
    ReceiptTransactionDraft,
    ReceiptUpdatePatch,
    Transaction,
} from './types'

export interface ReceiptsPageParams {
    limit?: number
    cursor?: string
    date_from?: string
    date_to?: string
    seller?: string
}

/** GET /api/v1/receipts — cursor-пагинация, новые сверху. */
export function fetchReceiptsPage(params: ReceiptsPageParams = {}): Promise<CursorPage<Receipt>> {
    const search = new URLSearchParams()
    if (params.limit !== undefined) search.set('limit', String(params.limit))
    if (params.cursor) search.set('cursor', params.cursor)
    if (params.date_from) search.set('date_from', params.date_from)
    if (params.date_to) search.set('date_to', params.date_to)
    if (params.seller) search.set('seller', params.seller)
    const qs = search.toString()
    return api.get<CursorPage<Receipt>>(`/api/v1/receipts${qs ? `?${qs}` : ''}`)
}

/** Все чеки (все страницы) — для дашборда. */
export async function fetchAllReceipts(): Promise<Receipt[]> {
    const items: Receipt[] = []
    let cursor: string | undefined
    // защитный лимит: 200 страниц × 100 = 20 000 чеков
    for (let i = 0; i < 200; i++) {
        const page = await fetchReceiptsPage({ limit: 100, cursor })
        items.push(...page.items)
        if (!page.next_cursor) break
        cursor = page.next_cursor
    }
    return items
}

export function getReceipt(id: string): Promise<Receipt> {
    return api.get<Receipt>(`/api/v1/receipts/${id}`)
}

/** GET /api/v1/receipts/{id}/raw — сырые данные чека (raw_json). */
export async function fetchReceiptRaw(id: string): Promise<Record<string, unknown>> {
    return api.get<Record<string, unknown>>(`/api/v1/receipts/${id}/raw`)
}

/** POST /api/v1/receipts — авто-загрузка по QR из proverkacheka (нужен токен). */
export function createReceiptFromQr(draft: ReceiptQrDraft): Promise<Receipt> {
    return api.post<Receipt>('/api/v1/receipts', draft)
}

/** POST /api/v1/receipts/{receipt_id}/transactions — транзакция в существующий чек. */
export function addReceiptTransaction(
    receiptId: string,
    draft: ReceiptTransactionDraft,
): Promise<Transaction> {
    return api.post<Transaction>(`/api/v1/receipts/${receiptId}/transactions`, draft)
}

export function updateReceipt(id: string, patch: ReceiptUpdatePatch): Promise<Receipt> {
    return api.patch<Receipt>(`/api/v1/receipts/${id}`, patch)
}

export function deleteReceipt(id: string): Promise<void> {
    return api.del(`/api/v1/receipts/${id}`)
}
