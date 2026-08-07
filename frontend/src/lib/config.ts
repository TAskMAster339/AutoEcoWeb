/**
 * Environment configuration.
 *
 * VITE_API_URL         — base URL of the backend API (empty = same origin / dev proxy).
 * VITE_USE_MOCK_API    — when 'true' (default) domain modules that have no backend
 *                        endpoint yet (transactions, summary, tags, rules) serve mock
 *                        data. Auth is ALWAYS wired to the real backend.
 *
 * See TODO.md for the list of endpoints the backend still has to provide.
 */
export const API_URL: string = (import.meta.env.VITE_API_URL as string | undefined) ?? ''

export const USE_MOCK_API: boolean = (import.meta.env.VITE_USE_MOCK_API ?? 'true') !== 'false'
