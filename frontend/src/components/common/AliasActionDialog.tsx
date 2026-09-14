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
import type { Alias, AliasScope } from '../../api/types'
import { useAliases, useUpdateAlias } from '../../hooks/useAliases'
import { appendAliasPattern } from '../../lib/aliasPatterns.mjs'

const MAX_RULE_PATTERN_LENGTH = 1000

interface AliasActionDialogProps {
  open: boolean
  scope: AliasScope
  sourceName: string
  onClose: () => void
  onCreateNew: () => void
}

export function AliasActionDialog({ open, scope, sourceName, onClose, onCreateNew }: AliasActionDialogProps) {
  const titleId = useId()
  const [step, setStep] = useState<'actions' | 'attach'>('actions')
  const [search, setSearch] = useState('')
  const [selectedRule, setSelectedRule] = useState<Alias | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const rulesQuery = useAliases(scope, search)
  const updateRule = useUpdateAlias()
  const rules = useMemo(() => rulesQuery.data?.pages.flatMap((page) => page.items) ?? [], [rulesQuery.data])
  const subjectGenitive = scope === 'seller' ? 'магазина' : 'товара'
  const subjectAccusative = scope === 'seller' ? 'магазин' : 'товар'

  useEffect(() => {
    if (!open) return
    setStep('actions')
    setSearch('')
    setSelectedRule(null)
    setFormError(null)
    updateRule.reset()
  }, [open, scope, sourceName]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open || step !== 'attach' || !rulesQuery.hasNextPage || rulesQuery.isFetchingNextPage) return
    void rulesQuery.fetchNextPage()
  }, [open, rulesQuery, step])

  const close = () => {
    if (!updateRule.isPending) onClose()
  }

  const attach = async () => {
    if (!selectedRule) {
      setFormError(`Выберите правило для ${subjectGenitive}`)
      return
    }
    const originalName = appendAliasPattern(selectedRule, sourceName)
    if (originalName.length > MAX_RULE_PATTERN_LENGTH) {
      setFormError('Новое условие длиннее 1000 символов. Сократите правило перед добавлением названия.')
      return
    }
    setFormError(null)
    try {
      await updateRule.mutateAsync({
        id: selectedRule.id,
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
          {step === 'actions' ? `Добавить правило для ${subjectGenitive}` : `Добавить ${subjectAccusative} в правило`}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {step === 'actions'
            ? `Выберите, как обработать «${sourceName.trim()}».`
            : `Найдите правило по названию. Текущее название ${subjectGenitive} добавится в его условие.`}
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
              Создать новое правило
            </Button>
            <Button
              variant="outlined"
              startIcon={<PlaylistAddOutlinedIcon />}
              onClick={() => setStep('attach')}
              sx={{ minHeight: 52, justifyContent: 'flex-start' }}
            >
              Добавить в существующее
            </Button>
          </Stack>
        ) : (
          <Autocomplete
            options={rules}
            value={selectedRule}
            onChange={(_, value) => {
              setSelectedRule(value)
              if (value) setSearch(value.alias_name)
              setFormError(null)
            }}
            inputValue={search}
            onInputChange={(_, value, reason) => {
              if (reason === 'input' || reason === 'clear') setSearch(value)
            }}
            getOptionLabel={(option) => option.alias_name}
            isOptionEqualToValue={(option, value) => option.id === value.id}
            loading={rulesQuery.isLoading || rulesQuery.isFetchingNextPage}
            openOnFocus
            autoHighlight
            selectOnFocus
            noOptionsText={rulesQuery.isError ? 'Не удалось загрузить правила' : 'Правила не найдены'}
            renderOption={(props, option) => (
              <Box component="li" {...props} key={option.id} sx={{ display: 'block !important', minHeight: 48 }}>
                <Typography noWrap sx={{ fontWeight: 600 }}>{option.alias_name}</Typography>
                <Typography variant="caption" color="text.secondary" noWrap>
                  Условие: {option.original_name}
                </Typography>
              </Box>
            )}
            renderInput={(params) => (
              <TextField
                {...params}
                autoFocus
                label={`Правило для ${subjectGenitive}`}
                placeholder="Найти по названию"
                helperText={rulesQuery.isError ? 'Проверьте подключение и попробуйте ещё раз' : `Выберите правило, к которому относится название ${subjectGenitive}`}
                slotProps={{
                  input: {
                    ...params.InputProps,
                    endAdornment: (
                      <>
                        {(rulesQuery.isLoading || rulesQuery.isFetchingNextPage) && <CircularProgress color="inherit" size={18} />}
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
        <Button fullWidth onClick={step === 'attach' ? () => setStep('actions') : close} disabled={updateRule.isPending}>
          {step === 'attach' ? 'Назад' : 'Отмена'}
        </Button>
        {step === 'attach' && (
          <Button fullWidth variant="contained" onClick={() => void attach()} disabled={!selectedRule || updateRule.isPending}>
            {updateRule.isPending ? <CircularProgress size={20} color="inherit" /> : 'Добавить'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  )
}
