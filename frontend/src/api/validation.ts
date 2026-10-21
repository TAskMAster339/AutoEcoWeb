import { z } from 'zod'
import type { User, Transaction, CursorPage, Receipt } from './types'

export const userSchema: z.ZodType<User> = z.object({
  id: z.string().uuid(), email: z.string(), role: z.enum(['user', 'admin']),
  status: z.enum(['pending', 'verified', 'active', 'blocked']),
})

const decimal = z.union([z.number(), z.string().regex(/^[+-]?\d+(\.\d+)?$/)])
  .transform(Number).pipe(z.number().finite())
const nullableDecimal = decimal.nullable()
export const transactionSchema = z.object({
  id: z.string().uuid().nullable(), receipt_id: z.string().uuid().nullable(),
  name: z.string(), normalized_name: z.string(), datetime: z.string(),
  amount: decimal, quantity: nullableDecimal, price: nullableDecimal, balance: nullableDecimal,
  operation_type: z.number().int(), position: z.number().nullable(), unit: z.string().nullable(),
  name_alias_id: z.string().nullable(), name_alias_name: z.string().nullable(),
  tag_id: z.string().nullable(), tag_source: z.enum(['manual', 'auto']).nullable(),
  tag_confidence: z.number().nullable(), seller_id: z.string().nullable(),
  seller_name: z.string().nullable(), normalized_seller_name: z.string().nullable(),
  seller_name_alias_id: z.string().nullable(), seller_name_alias_name: z.string().nullable(),
  comment: z.string().nullable(), created_at: z.string().nullable(),
}) satisfies z.ZodType<Transaction, unknown>

export const transactionPageSchema = z.object({
  items: z.array(transactionSchema), next_cursor: z.string().nullable(), total: z.number().int().nonnegative().nullable(),
}) satisfies z.ZodType<CursorPage<Transaction>, unknown>

export const receiptSchema = z.object({
  id: z.string().uuid(), qr: z.string().nullable(), receipt_number: z.string().nullable(),
  operation_type: z.number().int(), seller_name: z.string(), normalized_seller_name: z.string().nullable(),
  seller_id: z.string().uuid().nullable(),
  seller_name_alias_id: z.string().nullable(), seller_name_alias_name: z.string().nullable(),
  seller_inn: z.string().nullable(), datetime: z.string(), total_sum: decimal,
  cashback: nullableDecimal, balance_after: nullableDecimal, created_at: z.string(),
  transactions: z.array(transactionSchema),
}) satisfies z.ZodType<Receipt, unknown>
export const receiptPageSchema = z.object({
  items: z.array(receiptSchema), next_cursor: z.string().nullable(), total: z.number().int().nullable(),
}) satisfies z.ZodType<CursorPage<Receipt>, unknown>
