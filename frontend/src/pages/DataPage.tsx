import { useRef, useState } from 'react'
import {
  Box,
  Button,
  Card,
  Checkbox,
  Chip,
  CircularProgress,
  Stack,
  Typography,
  useTheme,
} from '@mui/material'
import { useQueryClient } from '@tanstack/react-query'
import DownloadOutlinedIcon from '@mui/icons-material/DownloadOutlined'
import FileUploadOutlinedIcon from '@mui/icons-material/FileUploadOutlined'
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline'
import { PageHeader } from '../components/common/PageHeader'
import {
  downloadExport,
  previewImport,
  runImport,
  type ImportPreview,
  type ImportResult,
  type ImportRowPreview,
} from '../api/importExport'
import { messageFromError } from '../api/client'
import { colors, softBg, softFg } from '../theme'

const FORMAT_HINT = 'Формат: Дата | Категория | Магазин | Описание | Доход | Расход (.xlsx или .csv)'

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-')
  return `${d}.${m}.${y}`
}

function formatMoney(value: string): string {
  const n = Number(value)
  if (!Number.isFinite(n) || n === 0) return ''
  return `${n.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₽`
}

type Stage = 'idle' | 'uploading' | 'preview' | 'importing' | 'done' | 'error'

export function DataPage() {
  const queryClient = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [stage, setStage] = useState<Stage>('idle')
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState<ImportPreview | null>(null)
  const [selected, setSelected] = useState<ReadonlySet<number>>(new Set())
  const [result, setResult] = useState<ImportResult | null>(null)

  const pickFile = () => fileInputRef.current?.click()

  const handleFile = async (file: File | undefined) => {
    if (!file) return
    setStage('uploading')
    setError(null)
    try {
      const p = await previewImport(file)
      setPreview(p)
      // по умолчанию импортируются только строки без ошибок
      setSelected(new Set(p.rows.filter((r) => r.errors.length === 0).map((r) => r.index)))
      setStage('preview')
    } catch (e) {
      setError(messageFromError(e))
      setStage('error')
    }
  }

  const toggleRow = (index: number) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(index)) next.delete(index)
      else next.add(index)
      return next
    })
  }

  const selectedCount = selected.size

  const handleImport = async () => {
    if (!preview || selectedCount === 0) return
    const rows = preview.rows
      .filter((r) => selected.has(r.index))
      .map((r) => ({
        date: r.date ?? '',
        category: r.category,
        store: r.store,
        description: r.description,
        income: r.income,
        expense: r.expense,
      }))
    setStage('importing')
    setError(null)
    try {
      const res = await runImport(rows)
      setResult(res)
      setStage('done')
      // данные изменились — сбросить кэши страниц
      void queryClient.invalidateQueries({ queryKey: ['transactions'] })
      void queryClient.invalidateQueries({ queryKey: ['summary'] })
      void queryClient.invalidateQueries({ queryKey: ['analytics'] })
      void queryClient.invalidateQueries({ queryKey: ['tags'] })
      void queryClient.invalidateQueries({ queryKey: ['receipts'] })
    } catch (e) {
      setError(messageFromError(e))
      setStage('error')
    }
  }

  const reset = () => {
    setStage('idle')
    setError(null)
    setPreview(null)
    setResult(null)
    setSelected(new Set())
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleExport = async () => {
    try {
      await downloadExport()
    } catch (e) {
      setError(messageFromError(e))
      setStage('error')
    }
  }

  return (
    <Stack spacing={2} sx={{ maxWidth: 720 }}>
      <PageHeader title="Данные" subtitle="Импорт и экспорт транзакций" />

      {/* Экспорт */}
      <Card sx={{ p: 2.5 }}>
        <Stack direction="row" alignItems="center" spacing={2} sx={{ flexWrap: 'wrap' }}>
          <Box sx={{ flex: 1, minWidth: 200 }}>
            <Typography sx={{ fontWeight: 700, fontSize: 15 }}>Экспорт</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              Скачать все транзакции в Excel: лист на месяц, колонки {FORMAT_HINT.split(': ')[1]}.
              Файл можно вести дальше вручную и импортировать обратно.
            </Typography>
          </Box>
          <Button
            variant="contained"
            startIcon={<DownloadOutlinedIcon />}
            onClick={handleExport}
            sx={{ borderRadius: '8px' }}
          >
            Скачать .xlsx
          </Button>
        </Stack>
      </Card>

      {/* Импорт */}
      <Card sx={{ p: 2.5 }}>
        <Typography sx={{ fontWeight: 700, fontSize: 15 }}>Импорт</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, mb: 2 }}>
          Загрузите файл — сервер разберёт его и покажет предпросмотр. Отсутствующие теги
          создадутся автоматически.
        </Typography>

        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.csv"
          hidden
          onChange={(e) => void handleFile(e.target.files?.[0])}
        />

        {stage === 'idle' && (
          <Button
            variant="outlined"
            startIcon={<FileUploadOutlinedIcon />}
            onClick={pickFile}
            sx={{ borderRadius: '8px' }}
          >
            Выбрать файл
          </Button>
        )}

        {stage === 'uploading' && (
          <Stack direction="row" alignItems="center" spacing={1.5}>
            <CircularProgress size={20} />
            <Typography variant="body2" color="text.secondary">
              Разбираем файл…
            </Typography>
          </Stack>
        )}

        {stage === 'error' && (
          <Stack spacing={1.5}>
            <Box
              sx={{
                p: 1.5,
                borderRadius: '8px',
                bgcolor: colors.redSoft,
                color: colors.red,
                fontSize: 14,
              }}
              role="alert"
            >
              {error}
            </Box>
            <Stack direction="row" spacing={1}>
              <Button variant="outlined" onClick={reset} sx={{ borderRadius: '8px' }}>
                Назад
              </Button>
              <Button variant="contained" onClick={pickFile} sx={{ borderRadius: '8px' }}>
                Выбрать другой файл
              </Button>
            </Stack>
          </Stack>
        )}

        {stage === 'preview' && preview && (
          <PreviewBlock
            preview={preview}
            selected={selected}
            onToggle={toggleRow}
            onImport={() => void handleImport()}
            onReset={reset}
          />
        )}

        {stage === 'importing' && (
          <Stack direction="row" alignItems="center" spacing={1.5}>
            <CircularProgress size={20} />
            <Typography variant="body2" color="text.secondary">
              Импортируем…
            </Typography>
          </Stack>
        )}

        {stage === 'done' && result && (
          <DoneBlock result={result} onReset={reset} />
        )}
      </Card>
    </Stack>
  )
}

function PreviewBlock({
  preview,
  selected,
  onToggle,
  onImport,
  onReset,
}: {
  preview: ImportPreview
  selected: ReadonlySet<number>
  onToggle: (index: number) => void
  onImport: () => void
  onReset: () => void
}) {
  const selectedCount = selected.size
  const categories = new Set(preview.rows.map((r) => r.category).filter(Boolean)).size

  return (
    <Stack spacing={2}>
      <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
        <Chip label={`Всего: ${preview.total}`} size="small" />
        <Chip
          label={`К импорту: ${selectedCount}`}
          size="small"
          sx={{ color: colors.green, bgcolor: colors.greenSoft }}
        />
        {preview.invalid > 0 && (
          <Chip
            label={`С ошибками: ${preview.invalid}`}
            size="small"
            sx={{ color: colors.red, bgcolor: colors.redSoft }}
          />
        )}
        {categories > 0 && <Chip label={`Тегов создастся: ${categories}`} size="small" />}
      </Stack>

      {preview.rows.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          В файле нет строк с данными.
        </Typography>
      ) : (
        <Stack spacing={0.75} sx={{ maxHeight: 420, overflowY: 'auto', pr: 0.5 }}>
          {preview.rows.map((row) => (
            <PreviewRow
              key={row.index}
              row={row}
              checked={selected.has(row.index)}
              onToggle={() => onToggle(row.index)}
            />
          ))}
        </Stack>
      )}

      <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
        <Button
          variant="contained"
          disabled={selectedCount === 0}
          onClick={onImport}
          sx={{ borderRadius: '8px' }}
        >
          {selectedCount > 0 ? `Импортировать (${selectedCount})` : 'Импортировать'}
        </Button>
        <Button variant="text" onClick={onReset} sx={{ borderRadius: '8px' }}>
          Отмена
        </Button>
      </Stack>
    </Stack>
  )
}

function PreviewRow({
  row,
  checked,
  onToggle,
}: {
  row: ImportRowPreview
  checked: boolean
  onToggle: () => void
}) {
  const theme = useTheme()
  const hasErrors = row.errors.length > 0
  const income = Number(row.income) > 0
  const amount = income ? formatMoney(row.income) : formatMoney(row.expense)

  return (
    <Box
      component="label"
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        p: 1,
        borderRadius: '8px',
        bgcolor: hasErrors ? softBg(theme) : 'transparent',
        border: `1px solid ${hasErrors ? theme.palette.divider : 'transparent'}`,
        cursor: 'pointer',
      }}
    >
      <Checkbox checked={checked} onChange={onToggle} size="small" sx={{ p: 0.5 }} />
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          <Typography sx={{ fontSize: 12.5, fontWeight: 600 }}>{formatDate(row.date)}</Typography>
          {row.category && (
            <Chip label={row.category} size="small" sx={{ height: 20, fontSize: 11 }} />
          )}
          {row.store && (
            <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>{row.store}</Typography>
          )}
        </Box>
        <Typography
          sx={{ fontSize: 13.5, mt: 0.25 }}
          color={row.description ? 'text.primary' : 'text.secondary'}
        >
          {row.description || '—'}
        </Typography>
        {hasErrors && (
          <Typography sx={{ fontSize: 12, color: colors.red, mt: 0.25 }}>
            {row.errors.join('; ')}
          </Typography>
        )}
      </Box>
      <Typography
        sx={{
          fontSize: 13.5,
          fontWeight: 700,
          flexShrink: 0,
          color: income ? colors.green : 'text.primary',
        }}
      >
        {amount ? `${income ? '+' : '−'}${amount}` : '—'}
      </Typography>
    </Box>
  )
}

function DoneBlock({ result, onReset }: { result: ImportResult; onReset: () => void }) {
  const theme = useTheme()
  return (
    <Stack spacing={1.5}>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          p: 1.5,
          borderRadius: '8px',
          bgcolor: colors.greenSoft,
          color: colors.green,
        }}
        role="status"
      >
        <CheckCircleOutlineIcon fontSize="small" />
        <Typography sx={{ fontSize: 14, fontWeight: 600 }}>
          Импортировано транзакций: {result.imported}
        </Typography>
      </Box>
      {result.tags_created.length > 0 && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap' }}>
          <Typography variant="body2" color="text.secondary">
            Созданные теги:
          </Typography>
          {result.tags_created.map((name) => (
            <Chip
              key={name}
              label={name}
              size="small"
              sx={{ bgcolor: softBg(theme), color: softFg(theme), borderRadius: '6px' }}
            />
          ))}
        </Box>
      )}
      {result.errors.length > 0 && (
        <Typography variant="body2" color="error">
          Пропущено строк: {result.errors.length} (ошибки валидации)
        </Typography>
      )}
      <Box>
        <Button variant="outlined" onClick={onReset} sx={{ borderRadius: '8px' }}>
          Импортировать ещё
        </Button>
      </Box>
    </Stack>
  )
}
