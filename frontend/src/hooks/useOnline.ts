import { useEffect, useState } from 'react'

/**
 * True while the browser is offline. Listens to online/offline events
 * so pages can show the OfflineState instead of a confusing error.
 */
export function useOnline(): boolean {
  const [online, setOnline] = useState<boolean>(() => navigator.onLine)

  useEffect(() => {
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [])

  return online
}
