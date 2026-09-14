import { useEffect, useId, useMemo, useState } from 'react'
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import AddLinkOutlinedIcon from '@mui/icons-material/AddLinkOutlined'
import PlaylistAddOutlinedIcon from '@mui/icons-material/PlaylistAddOutlined'
import { messageFromError } from '../../api/client'
import type { Alias } from '../../api/types'
import { useAliases, useUpdateAlias } from '../../hooks/useAliases'
import { appendAliasPattern } from '../../lib/aliasPatterns.mjs'

const MAX_ALIAS_PATTERN_LENGTH = 1000

interface ProductAliasActionDialogProps {
  open: boolean
  productName: string
  onClose: () => void
  onCreateNew: () => void
}

export function ProductAliasActionDialog({ open, productName, onClose, onCreateNew }: ProductAliasActionDialogProps) {
  const titleId = useId()
  const [step, setStep] = useState<'actions' | 'attach'>('actions')
  const [search, setSearch] = useState('')
  const [selectedAlias, setSelectedAlias] = useState<Alias | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const aliasesQuery = useAliases('product', search)
  const updateAlias = useUpdateAlias()
  const aliases = useMemo(() => aliasesQuery.data?.pages.flatMap((page) => page.items) ?? [], [aliasesQuery.data])

  useEffect(() => {
    if (!open) return
    setStep('actions')
    setSearch('')
    setSelectedAlias(null)
    setFormError(null)
    updateAlias.reset()
  }, [open, productName]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open || step !== 'attach' || !aliasesQuery.hasNextPage || aliasesQuery.isFetchingNextPage) return
    void aliasesQuery.fetchNextPage()
  }, [aliasesQuery, open, step])

  const close = () => {
    if (!updateAlias.isPending) onClose()
  }

  const attach = async () => {
    if (!selectedAlias) {
      setFormError('Выберите алиас товара')
      return
    }
    const originalName = appendAliasPattern(selectedAlias, productName)
    if (originalName.length > MAX_ALIAS_PATTERN_LENGTH) {
      setFormError('Новое правило длиннее 1000 символов. Сократите правило перед присоединением товара.')
      return
    }
    setFormError(null)
    try {
      await updateAlias.mutateAsync({
        id: selectedAlias.id,
        patch: { original_name: originalName, is_regex: true },
      })
      onClose()
    } catch (error) {
      setFormError(messageFromError(error))
    }
  }

  return (
    <Dialog
      open={open}
      onClose={close}
      fullWidth
      maxWidth="xs"
      aria-labelledby={titleId}
      slotProps={{ paper: { sx: { borderRadius: { xs: 0, sm: '10px' }, p: 2, m: { xs: 0, sm: 4 }, width: { xs: '100%', sm: 'calc(100% - 64px)' } } } }}
    >
      <DialogContent sx={{ p: 0, overflow: 'visible' }}>
        <Typography id={titleId} sx={{ fontSize: 17, fontWeight: 700, mb: 0.75 }}>
          {step === 'actions' ? 'Добавить алиас товара' : 'Присоединить к алиасу'}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {step === 'actions'
            ? `Выберите, как обработать «${productName.trim()}».`
            : 'Найдите алиас по названию. Текущее название товара добавится в его правило.'}
        </Typography>

        {formError && <Alert severity="error" sx={{ mb: 1.5, borderRadius: '8px' }}>{formError}</Alert>}

        {step === 'actions' ? (
          <Stack spacing={1}>
            <Button
              variant="outlined"
              startIcon={<AddLinkOutlinedIcon />}
              onClick={onCreateNew}
              sx={{ minHeight: 52, justifyContent: 'flex-start' }}
            >
              Создать новый алиас
            </Button>
            <Button
              variant="outlined"
              startIcon={<PlaylistAddOutlinedIcon />}
              onClick={() => setStep('attach')}
              sx={{ minHeight: 52, justifyContent: 'flex-start' }}
            >
              Присоединить к существующему
            </Button>
          </Stack>
        ) : (
          <Autocomplete
            options={aliases}
            value={selectedAlias}
            onChange={(_, value) => {
              setSelectedAlias(value)
              if (value) setSearch(value.alias_name)
              setFormError(null)
            }}
            inputValue={search}
            onInputChange={(_, value, reason) => {
              if (reason === 'input' || reason === 'clear') setSearch(value)
            }}
            getOptionLabel={(option) => option.alias_name}
            isOptionEqualToValue={(option, value) => option.id === value.id}
            loading={aliasesQuery.isLoading || aliasesQuery.isFetchingNextPage}
            openOnFocus
            autoHighlight
            selectOnFocus
            noOptionsText={aliasesQuery.isError ? 'Не удалось загрузить алиасы' : 'Алиасы не найдены'}
            renderOption={(props, option) => (
              <Box component="li" {...props} key={option.id} sx={{ display: 'block !important', minHeight: 48 }}>
                <Typography noWrap sx={{ fontWeight: 600 }}>{option.alias_name}</Typography>
                <Typography variant="caption" color="text.secondary" noWrap>
                  Правило: {option.original_name}
                </Typography>
              </Box>
            )}
            renderInput={(params) => (
              <TextField
                {...params}
                autoFocus
                label="Алиас товара"
                placeholder="Найти по названию"
                helperText={aliasesQuery.isError ? 'Проверьте подключение и попробуйте ещё раз' : 'Выберите алиас, к которому относится этот товар'}
                slotProps={{
                  input: {
                    ...params.InputProps,
                    endAdornment: (
                      <>
                        {(aliasesQuery.isLoading || aliasesQuery.isFetchingNextPage) && <CircularProgress color="inherit" size={18} />}
                        {params.InputProps.endAdornment}
                      </>
                    ),
                  },
                }}
              />
            )}
          />
        )}
      </DialogContent>

      <DialogActions sx={{ px: 0, pb: 0, pt: 2, flexDirection: { xs: 'column-reverse', sm: 'row' }, gap: 1 }}>
        <Button fullWidth onClick={step === 'attach' ? () => setStep('actions') : close} disabled={updateAlias.isPending}>
          {step === 'attach' ? 'Назад' : 'Отмена'}
        </Button>
        {step === 'attach' && (
          <Button fullWidth variant="contained" onClick={() => void attach()} disabled={!selectedAlias || updateAlias.isPending}>
            {updateAlias.isPending ? <CircularProgress size={20} color="inherit" /> : 'Присоединить'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  )
}
