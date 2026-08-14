import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

interface PageMeta {
  title: string
  description: string
  indexable?: boolean
}

const DEFAULT_META: PageMeta = {
  title: 'AutoEco — учёт чеков и расходов',
  description: 'AutoEco помогает учитывать чеки, доходы и расходы, анализировать покупки и наводить порядок в личных финансах.',
}

const PAGE_META: Record<string, PageMeta> = {
  '/login': { title: 'Вход — AutoEco', description: 'Войдите в AutoEco, чтобы управлять чеками, доходами и расходами.' },
  '/recover': { title: 'Восстановление доступа — AutoEco', description: 'Восстановление доступа к аккаунту AutoEco.' },
  '/verify-email': { title: 'Подтверждение почты — AutoEco', description: 'Подтвердите адрес электронной почты для AutoEco.' },
  '/privacy': { title: 'Политика конфиденциальности — AutoEco', description: 'Политика конфиденциальности сервиса AutoEco.', indexable: true },
  '/transactions': { title: 'Транзакции — AutoEco', description: 'Доходы, расходы, фильтры по сумме, магазинам и тегам.' },
  '/receipt': { title: 'Чеки — AutoEco', description: 'Список сохранённых чеков и покупок.' },
  '/analytics': { title: 'Аналитика расходов — AutoEco', description: 'Аналитика доходов, расходов, категорий, магазинов и динамики цен.' },
  '/tags': { title: 'Теги — AutoEco', description: 'Управление тегами для классификации доходов и расходов.' },
  '/sellers': { title: 'Магазины — AutoEco', description: 'Управление магазинами и продавцами.' },
  '/rules': { title: 'Правила — AutoEco', description: 'Правила автоматической нормализации магазинов и товаров.' },
  '/data': { title: 'Импорт и экспорт — AutoEco', description: 'Импорт и экспорт финансовых данных AutoEco.' },
  '/profile': { title: 'Профиль — AutoEco', description: 'Настройки профиля AutoEco.' },
  '/admin': { title: 'Администрирование — AutoEco', description: 'Панель администрирования AutoEco.' },
  '/about': { title: 'Справка — AutoEco', description: 'Справочный центр AutoEco.' },
  '/feedback': { title: 'Обратная связь — AutoEco', description: 'Связаться с командой AutoEco.' },
}

function setMeta(selector: string, attribute: 'name' | 'property', key: string, content: string) {
  let element = document.head.querySelector<HTMLMetaElement>(selector)
  if (!element) {
    element = document.createElement('meta')
    element.setAttribute(attribute, key)
    document.head.appendChild(element)
  }
  element.content = content
}

function metaFor(pathname: string): PageMeta {
  if (pathname.startsWith('/receipts/')) {
    return { title: 'Детали чека — AutoEco', description: 'Состав и данные сохранённого чека AutoEco.' }
  }
  if (pathname.startsWith('/about/')) return PAGE_META['/about'] ?? DEFAULT_META
  return PAGE_META[pathname] ?? DEFAULT_META
}

/** Синхронизирует browser title, canonical, description и social-card metadata с маршрутом. */
export function SeoMeta() {
  const { pathname } = useLocation()

  useEffect(() => {
    const meta = metaFor(pathname)
    const canonicalUrl = `${window.location.origin}${pathname}`
    const imageUrl = `${window.location.origin}/social-preview.png`

    document.title = meta.title
    setMeta('meta[name="description"]', 'name', 'description', meta.description)
    setMeta('meta[name="robots"]', 'name', 'robots', meta.indexable ? 'index,follow' : 'noindex,nofollow')
    setMeta('meta[property="og:title"]', 'property', 'og:title', meta.title)
    setMeta('meta[property="og:description"]', 'property', 'og:description', meta.description)
    setMeta('meta[property="og:url"]', 'property', 'og:url', canonicalUrl)
    setMeta('meta[property="og:image"]', 'property', 'og:image', imageUrl)
    setMeta('meta[name="twitter:title"]', 'name', 'twitter:title', meta.title)
    setMeta('meta[name="twitter:description"]', 'name', 'twitter:description', meta.description)
    setMeta('meta[name="twitter:image"]', 'name', 'twitter:image', imageUrl)

    let canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')
    if (!canonical) {
      canonical = document.createElement('link')
      canonical.rel = 'canonical'
      document.head.appendChild(canonical)
    }
    canonical.href = canonicalUrl
  }, [pathname])

  return null
}
