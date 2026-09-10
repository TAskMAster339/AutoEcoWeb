import { useEffect, useState, type KeyboardEvent } from 'react'
import { Alert, Box, Button, CircularProgress, Stack, Typography } from '@mui/material'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import { BottomSheet } from '../common/BottomSheet'
import { TagAutocomplete } from '../common/TagAutocomplete'
import { useUpdateTransaction } from '../../hooks/useTransactions'
import { messageFromError } from '../../api/client'
import { formatCurrency, formatLongDate } from '../../lib/format'
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
  const displayedPrice = tx.price ?? tx.income ?? tx.expense
  const priceLabel = tx.price === null || tx.price === undefined ? 'Сумма' : 'Цена'

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

        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1fr) minmax(104px, 42%)',
            columnGap: 2,
            px: 1.5,
            py: 1.25,
            borderRadius: '8px',
            bgcolor: 'action.hover',
          }}
        >
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="subtitle2" sx={{ overflowWrap: 'anywhere' }}>
              {tx.name}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {formatLongDate(tx.date)}
            </Typography>
          </Box>
          <Box sx={{ minWidth: 0, textAlign: 'right' }}>
            <Typography variant="subtitle2" noWrap title={tx.store ?? 'Без магазина'}>
              {tx.store ?? 'Без магазина'}
            </Typography>
            <Typography variant="caption" color="text.secondary" className="tnum">
              {priceLabel}: {formatCurrency(displayedPrice)}
            </Typography>
          </Box>
        </Box>

        <TagAutocomplete tags={tags} value={selectedTag} onChange={setSelectedTag} />

        {selectedTag !== null && (
          <Button
            fullWidth
            variant="outlined"
            color="primary"
            startIcon={<DeleteOutlineIcon />}
            onClick={() => setSelectedTag(null)}
            disabled={updateTx.isPending}
            sx={{ minHeight: 48 }}
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
