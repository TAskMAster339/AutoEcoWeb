import { useEffect, useId, useState } from 'react'
import {
  Alert,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  IconButton,
  InputAdornment,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import AddLinkOutlinedIcon from '@mui/icons-material/AddLinkOutlined'
import { useCreateAlias } from '../../hooks/useAliases'
import type { AliasScope } from '../../api/types'

interface CreateAliasDialogProps {
  open: boolean
  scope: AliasScope
  originalName: string
  onClose: () => void
}

/** Быстрое создание алиаса прямо из формы редактирования транзакции. */
export function CreateAliasDialog({ open, scope, originalName, onClose }: CreateAliasDialogProps) {
  const titleId = useId()
  const createAlias = useCreateAlias()
  const [aliasName, setAliasName] = useState('')
  const [formError, setFormError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setAliasName('')
    setFormError(null)
  }, [open, originalName, scope])

  const submit = async () => {
    const original = originalName.trim()
    const alias = aliasName.trim()
    if (!original) {
      setFormError(`Сначала укажите название ${scope === 'seller' ? 'магазина' : 'товара'}`)
      return
    }
    if (!alias) {
      setFormError('Укажите новое название')
      return
    }
    try {
      await createAlias.mutateAsync({
        original_name: original,
        alias_name: alias,
        scope,
      })
      onClose()
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Не удалось создать алиас')
    }
  }

  return (
    <Dialog
      open={open}
      onClose={createAlias.isPending ? undefined : onClose}
      fullWidth
      maxWidth="xs"
      aria-labelledby={titleId}
      slotProps={{ paper: { sx: { borderRadius: { xs: 0, sm: '10px' }, p: 2, m: { xs: 0, sm: 4 }, width: { xs: '100%', sm: 'calc(100% - 64px)' } } } }}
    >
      <DialogContent sx={{ p: 0, overflow: 'visible' }}>
        <Typography id={titleId} sx={{ fontSize: 17, fontWeight: 700, mb: 0.75 }}>
          Создать алиас {scope === 'seller' ? 'магазина' : 'товара'}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Алиас сразу применится к подходящим существующим записям.
        </Typography>
        {formError && <Alert severity="error" sx={{ mb: 1.5, borderRadius: '8px' }}>{formError}</Alert>}
        <Stack spacing={1.5}>
          <TextField label="Текущее название" value={originalName} fullWidth slotProps={{ input: { readOnly: true } }} />
          <TextField
            label="Новое название"
            value={aliasName}
            onChange={(event) => setAliasName(event.target.value)}
            fullWidth
            autoFocus
            placeholder={scope === 'seller' ? 'Например: Перекрёсток' : 'Например: Молоко 3,2%'}
            onKeyDown={(event) => {
              if (event.key === 'Enter') void submit()
            }}
          />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 0, pb: 0, pt: 2, flexDirection: { xs: 'column-reverse', sm: 'row' }, gap: 1 }}>
        <Button fullWidth onClick={onClose} disabled={createAlias.isPending}>Отмена</Button>
        <Button fullWidth variant="contained" onClick={() => void submit()} disabled={createAlias.isPending} sx={{ minWidth: 120 }}>
          {createAlias.isPending ? <CircularProgress size={20} color="inherit" /> : 'Создать'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

interface AliasShortcutProps {
  scope: AliasScope
  originalName: string
  onClick: () => void
}

/** Кнопка-шорткат для размещения в InputAdornment формы. */
export function AliasShortcut({ scope, originalName, onClick }: AliasShortcutProps) {
  return (
    <InputAdornment position="end">
      <IconButton
        size="small"
        edge="end"
        onClick={onClick}
        disabled={!originalName.trim()}
        aria-label={`Создать алиас ${scope === 'seller' ? 'магазина' : 'товара'}`}
        sx={{ borderRadius: '6px' }}
      >
        <AddLinkOutlinedIcon fontSize="small" />
      </IconButton>
    </InputAdornment>
  )
}