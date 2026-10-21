/** Base URL of the backend API (empty = same origin / dev proxy). */
export const API_URL: string = (import.meta.env.VITE_API_URL as string | undefined) ?? ''
