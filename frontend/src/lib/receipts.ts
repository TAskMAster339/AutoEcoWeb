import type { Receipt as ApiReceipt, Transaction as ApiTransaction, TransactionView } from '../api/types'
import { isIncomeOperation } from '../api/transactions'
import { displayAlias } from './aliases'

/** Карточка чека на дашборде (display-контракт ReceiptCard). */
export interface Receipt {
  id: string
  store: string
  date: string
  items: TransactionView[]
  total: number
  isIncome: boolean
  tagIds: string[]
}

/** Маппинг backend-чека (ReceiptResponse.transactions) в карточку дашборда. */
export function mapReceipt(r: ApiReceipt): Receipt {
  const items: TransactionView[] = (r.transactions ?? []).map((tx) =>
    receiptTransactionToView(tx, r),
  )
  return {
    id: r.id,
    store: displayAlias(r.seller_name_alias_name, r.normalized_seller_name, r.seller_name),
    date: r.datetime.slice(0, 10),
    items,
    total: Number(r.total_sum),
    isIncome: isIncomeOperation(r.operation_type),
    tagIds: [...new Set(items.flatMap((t) => (t.tagId ? [t.tagId] : [])))],
  }
}

/** Транзакция внутри чека → строка карточки (сумма = amount, не позиция). */
export function receiptTransactionToView(tx: ApiTransaction, r: ApiReceipt): TransactionView {
  const income = isIncomeOperation(tx.operation_type)
  return {
    id: tx.id ?? `${r.id}-${tx.name}`,
    store: displayAlias(tx.seller_name_alias_name, tx.normalized_seller_name, tx.seller_name),
    date: tx.datetime.slice(0, 10),
    tagId: tx.tag_id,
    name: displayAlias(tx.name_alias_name, tx.normalized_name, tx.name),
    comment: tx.comment,
    quantity: tx.quantity !== null && tx.quantity !== undefined ? Number(tx.quantity) : null,
    price: tx.price !== null && tx.price !== undefined ? Number(tx.price) : null,
    income: income ? Number(tx.amount) : null,
    expense: income ? null : Number(tx.amount),
    balance: 0,
  }
}
