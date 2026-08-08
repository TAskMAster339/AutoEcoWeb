/**
 * Environment configuration.
 *
 * VITE_API_URL         — base URL of the backend API (empty = same origin / dev proxy).
 * VITE_USE_MOCK_API    — legacy flag. Все доменные модули (receipts, tags, aliases,
 *                        transactions/summary/analytics — производные от чеков)
 *                        используют реальный API; флаг ни на что не влияет и оставлен
 *                        только для обратной совместимости сборки.
 *
 * See TODO.md for the list of endpoints the backend still has to provide.
 */
export const API_URL: string = (import.meta.env.VITE_API_URL as string | undefined) ?? ''

export const USE_MOCK_API: boolean = (import.meta.env.VITE_USE_MOCK_API ?? 'true') !== 'false'
