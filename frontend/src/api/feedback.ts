import { api } from './client'
import type { Feedback, FeedbackAnswer, FeedbackCreate } from './types'

export interface FeedbackPage {
  items: Feedback[]
  total: number
  limit: number
  offset: number
}

export function createFeedback(data: FeedbackCreate): Promise<Feedback> {
  return api.post<Feedback>('/api/v1/feedback', data)
}

export async function fetchFeedback(status?: string, limit = 20, offset = 0): Promise<FeedbackPage> {
  const params = new URLSearchParams({ limit: String(limit), offset: String(offset) })
  if (status) params.set('status', status)
  const response = await api.get<FeedbackPage | Feedback[]>(`/api/v1/feedback?${params.toString()}`)
  // Compatibility with a running backend container that still returns the old bare array.
  if (Array.isArray(response)) {
    return { items: response, total: response.length, limit, offset }
  }
  return response
}

export function fetchMyFeedback(): Promise<Feedback[]> {
  return api.get<Feedback[]>('/api/v1/feedback/me')
}

export function answerFeedback(id: string, data: FeedbackAnswer): Promise<Feedback> {
  return api.post<Feedback>(`/api/v1/feedback/${id}/answer`, data)
}

export function closeFeedback(id: string): Promise<Feedback> {
  return api.post<Feedback>(`/api/v1/feedback/${id}/close`)
}

export const FEEDBACK_TEMPLATES = [
  { label: 'Запрос получен', text: 'Спасибо за обращение! Мы получили ваш запрос и уже взяли его в работу.' },
  { label: 'Нужны детали', text: 'Спасибо за обращение. Пожалуйста, уточните детали проблемы и приложите дополнительные сведения, если это возможно.' },
  { label: 'Проверяем', text: 'Мы проверяем описанную ситуацию. Вернёмся с ответом, как только получим результаты.' },
  { label: 'Доступ открыт', text: 'Ваша почта подтверждена, доступ к сервису открыт. Добро пожаловать в AutoEco!' },
]
