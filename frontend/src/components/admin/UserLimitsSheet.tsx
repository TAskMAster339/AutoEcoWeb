import { useEffect, useState } from 'react'
import { Alert, Button, Stack, TextField, Typography } from '@mui/material'
import { BottomSheet } from '../common/BottomSheet'
import { messageFromError } from '../../api/client'
import { useUpdateUserLimits } from '../../hooks/useAdminUsers'
import type { AdminUser, UserLimits } from '../../api/types'

const FIELDS: Array<{ key: keyof UserLimits; label: string; hint: string }> = [
  { key: 'max_tags', label: 'Теги', hint: 'Всего тегов' },
  { key: 'max_seller_aliases', label: 'Алиасы магазинов', hint: 'Отдельный лимит' },
  { key: 'max_product_aliases', label: 'Алиасы товаров', hint: 'Отдельный лимит' },
  { key: 'max_receipts', label: 'Чеки', hint: 'Всего чеков' },
  { key: 'max_transactions', label: 'Транзакции', hint: 'Включая позиции чеков' },
  { key: 'max_receipt_items', label: 'Позиций в чеке', hint: 'Для одного чека' },
  { key: 'max_import_rows', label: 'Строк за импорт', hint: 'Для одной операции импорта' },
]

export function UserLimitsSheet({
  user,
  onClose,
}: {
  user: AdminUser | null
  onClose: () => void
}) {
  const mutation = useUpdateUserLimits()
  const [values, setValues] = useState<Record<keyof UserLimits, string>>(() => emptyValues())
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return
    setValues(Object.fromEntries(
      FIELDS.map(({ key }) => [key, String(user.limits[key])]),
    ) as Record<keyof UserLimits, string>)
    setError(null)
  }, [user])

  const save = async () => {
    if (!user) return
    const patch = {} as UserLimits
    for (const { key } of FIELDS) {
      const value = Number(values[key])
      if (!Number.isSafeInteger(value) || value < 0) {
        setError('Все лимиты должны быть целыми неотрицательными числами')
        return
      }
      patch[key] = value
    }
    setError(null)
    try {
      await mutation.mutateAsync({ id: user.id, patch })
      onClose()
    } catch (caught) {
      setError(messageFromError(caught))
    }
  }

  return (
    <BottomSheet open={user !== null} onClose={onClose} title="Лимиты пользователя" maxWidth={560}>
      <Stack spacing={2}>
        <Typography variant="body2" color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>
          {user?.email}. Уменьшение лимита не удалит существующие данные, но запретит создавать новые.
        </Typography>
        {error && <Alert severity="error">{error}</Alert>}
        <Stack spacing={1.5}>
          {FIELDS.map(({ key, label, hint }) => (
            <TextField
              key={key}
              label={label}
              value={values[key]}
              onChange={(event) => setValues((current) => ({
                ...current,
                [key]: event.target.value.replace(/[^0-9]/g, ''),
              }))}
              helperText={hint}
              inputMode="numeric"
              disabled={mutation.isPending}
              slotProps={{ htmlInput: { min: 0, step: 1 } }}
              fullWidth
            />
          ))}
        </Stack>
        <Button
          variant="contained"
          size="large"
          onClick={() => void save()}
          disabled={mutation.isPending}
          sx={{ minHeight: 48 }}
        >
          {mutation.isPending ? 'Сохраняем…' : 'Сохранить лимиты'}
        </Button>
      </Stack>
    </BottomSheet>
  )
}

function emptyValues(): Record<keyof UserLimits, string> {
  return {
    max_tags: '',
    max_seller_aliases: '',
    max_product_aliases: '',
    max_receipts: '',
    max_transactions: '',
    max_receipt_items: '',
    max_import_rows: '',
  }
}
