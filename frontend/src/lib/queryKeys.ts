import type { AliasScope } from '../api/types'
import type { TransactionsPageParams } from '../api/transactions'
import { userQueryKey } from './querySession'

/** Canonical query-key factory for user-scoped server state. */
export const queryKeys = {
  transactions: {
    pages: () => userQueryKey('transactions', 'pages'),
    page: (...parts: readonly unknown[]) => userQueryKey('transactions', 'pages', ...parts),
    total: () => userQueryKey('transactions', 'total'),
    untaggedTotal: () => userQueryKey('transactions', 'untagged-total'),
  },
  stores: {
    all: () => userQueryKey('stores'),
  },
  receipts: {
    all: () => userQueryKey('receipts'),
    list: (search: string) => userQueryKey('receipts', search),
    detail: (id: string) => userQueryKey('receipt', id),
    raw: (id: string) => userQueryKey('receipt-raw', id),
  },
  aliases: {
    all: () => userQueryKey('aliases'),
    list: (scope: AliasScope, search: string) => userQueryKey('aliases', scope, search),
  },
  sellers: {
    all: () => userQueryKey('sellers'),
  },
  summary: {
    all: () => userQueryKey('summary'),
    filtered: (params: TransactionsPageParams) => userQueryKey('summary', params),
  },
  analytics: {
    all: () => userQueryKey('analytics'),
    filtered: (params: TransactionsPageParams) => userQueryKey('analytics', params),
  },
  priceChart: {
    filtered: (query: string, isRegex: boolean, period: unknown) =>
      userQueryKey('price-chart', query, isRegex, period),
  },
  tags: {
    all: () => userQueryKey('tags'),
    pages: () => userQueryKey('tags-page'),
  },
  userLimits: {
    all: () => userQueryKey('user-limits'),
  },
  feedback: {
    all: () => userQueryKey('feedback'),
    list: (...parts: readonly unknown[]) => userQueryKey('feedback', ...parts),
    mine: () => userQueryKey('feedback', 'mine'),
  },
  adminUsers: {
    all: () => userQueryKey('admin-users'),
    list: (filters: unknown) => userQueryKey('admin-users', filters),
  },
  autoTagging: {
    all: () => userQueryKey('auto-tagging'),
  },
} as const
