import { useEffect, useState, type KeyboardEvent } from 'react'
import { Alert, Box, Button, CircularProgress, Stack, Typography } from '@mui/material'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import { BottomSheet } from '../common/BottomSheet'
import { TagAutocomplete } from '../common/TagAutocomplete'
import { useUpdateTransaction } from '../../hooks/useTransactions'
import { messageFromError } from '../../api/client'
import { formatLongDate } from '../../lib/format'
import type { Tag, Transaction, TransactionUpdatePatch, TransactionView } from '../../api/types'

interface QuickTagSheetProps {
  tx: TransactionView | null
  tags: Tag[]
  open: boolean
  onClose: () => void
  onSaved?: (updated: Transaction, patch: TransactionUpdatePatch) => void
}

/** Короткий мобильный сценарий: меняет только тег, не открывая полную форму. */
export function QuickTagSheet({ tx, tags, open, onClose, onSaved }: QuickTagSheetProps) {
  const updateTx = useUpdateTransaction()
  const [selectedTag, setSelectedTag] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open || !tx) return
    setSelectedTag(tx.tagId)
    setError(null)
  }, [open, tx])

  if (!tx) return null

  const changed = selectedTag !== tx.tagId

  const close = () => {
    if (!updateTx.isPending) onClose()
  }

  const save = async () => {
    if (!changed || updateTx.isPending) return
    setError(null)
    try {
      const patch = { tag_id: selectedTag }
      const updated = await updateTx.mutateAsync({ id: tx.id, patch, refreshRows: false })
      onSaved?.(updated, patch)
      onClose()
    } catch (caught) {
      setError(messageFromError(caught))
    }
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key !== 'Escape') return
    event.preventDefault()
    event.stopPropagation()
    close()
  }

  return (
    <BottomSheet
      open={open}
      onClose={close}
      title={tx.tagId ? 'Изменить тег' : 'Назначить тег'}
      maxWidth={480}
      maxHeight="60dvh"
    >
      <Stack spacing={2} onKeyDown={handleKeyDown}>
        {error && <Alert severity="error">{error}</Alert>}

        <Box sx={{ px: 1.5, py: 1.25, borderRadius: '8px', bgcolor: 'action.hover' }}>
          <Typography variant="subtitle2" sx={{ overflowWrap: 'anywhere' }}>
            {tx.name}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {tx.store ?? 'Без магазина'} · {formatLongDate(tx.date)}
          </Typography>
        </Box>

        <TagAutocomplete tags={tags} value={selectedTag} onChange={setSelectedTag} />

        {selectedTag !== null && (
          <Button
            variant="text"
            color="inherit"
            startIcon={<DeleteOutlineIcon />}
            onClick={() => setSelectedTag(null)}
            disabled={updateTx.isPending}
            sx={{ alignSelf: 'flex-start', minHeight: 44 }}
          >
            Убрать тег
          </Button>
        )}

        <Box sx={{ position: 'sticky', bottom: 0, pt: 1, pb: 'env(safe-area-inset-bottom)', bgcolor: 'background.paper' }}>
          <Button
            fullWidth
            variant="contained"
            onClick={() => void save()}
            disabled={!changed || updateTx.isPending}
            sx={{ minHeight: 48 }}
          >
            {updateTx.isPending ? <CircularProgress size={20} color="inherit" /> : 'Сохранить тег'}
          </Button>
        </Box>
      </Stack>
    </BottomSheet>
  )
}
