import { useState } from 'react'
import {
    Alert,
    Box,
    Button,
    Chip,
    Stack,
    TextField,
    Typography,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'

interface RegexBuilderProps {
    value: string
    onChange: (value: string) => void
    scope: 'seller' | 'product'
}

const TOKENS = [
    { label: 'Любой текст', token: '*', hint: 'ноль или больше любых символов' },
    { label: 'Один символ', token: '?', hint: 'ровно один любой символ' },
    { label: 'Есть цифры', token: '\\d+', hint: 'одна или больше цифр' },
    { label: 'Есть пробел', token: '\\s+', hint: 'один или больше пробелов' },
    { label: 'Или', token: '|', hint: 'любой из вариантов слева и справа' },
    { label: 'Начало названия', token: '^', hint: 'следующий текст должен быть в начале' },
    { label: 'Конец названия', token: '$', hint: 'предыдущий текст должен быть в конце' },
] as const

function escapeLiteral(value: string) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function RegexBuilder({ value, onChange, scope }: RegexBuilderProps) {
    const [literal, setLiteral] = useState('')

    const append = (token: string) => onChange(`${value}${token}`)
    const addLiteral = () => {
        const text = literal.trim()
        if (!text) return
        append(escapeLiteral(text))
        setLiteral('')
    }

    return (
        <Stack spacing={{ xs: 1.25, sm: 1.5 }}>
            <Alert severity="info" sx={{ borderRadius: '8px', py: { xs: 0.5, sm: 0.75 } }}>
                Соберите условие кнопками — знать regex не требуется. Регистр букв не учитывается.
            </Alert>

            <TextField
                label="Готовый шаблон"
                value={value}
                onChange={(event) => onChange(event.target.value)}
                fullWidth
                autoFocus
                size="small"
                placeholder={scope === 'seller' ? '*перекр?сток*' : '*сырок*45?*'}
                helperText={`${value.length}/255 · шаблон можно поправить вручную`}
                slotProps={{ htmlInput: { maxLength: 255 } }}
            />

            <Box>
                <Typography variant="subtitle2" sx={{ mb: 0.75 }}>Добавить условие</Typography>
                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', sm: 'repeat(auto-fit, minmax(120px, max-content))' }, gap: 0.75 }}>
                    {TOKENS.map(({ label, token, hint }) => (
                        <Chip
                            key={label}
                            label={label}
                            onClick={() => append(token)}
                            title={`${label}: ${hint}`}
                            color="primary"
                            variant="outlined"
                            clickable
                            sx={{ borderRadius: '6px', width: '100%', minHeight: 38, justifyContent: 'center' }}
                        />
                    ))}
                </Box>
            </Box>

            <Box>
                <Typography variant="subtitle2" sx={{ mb: 0.75 }}>Добавить обычную строку</Typography>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                    <TextField
                        value={literal}
                        onChange={(event) => setLiteral(event.target.value)}
                        onKeyDown={(event) => {
                            if (event.key !== 'Enter') return
                            event.preventDefault()
                            event.stopPropagation()
                            addLiteral()
                        }}
                        placeholder={scope === 'seller' ? 'например: Перекрёсток' : 'например: молоко'}
                        size="small"
                        fullWidth
                        aria-label="Строка для добавления в шаблон"
                    />
                    <Button
                        variant="outlined"
                        startIcon={<AddIcon />}
                        onClick={addLiteral}
                        disabled={!literal.trim()}
                        fullWidth
                        sx={{ flexShrink: 0, width: { sm: 'auto' }, minHeight: 40 }}
                    >
                        Добавить
                    </Button>
                </Stack>
                <Typography variant="caption" color="text.secondary">
                    Специальные символы будут экранированы автоматически.
                </Typography>
            </Box>

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ alignItems: { xs: 'stretch', sm: 'center' }, justifyContent: 'space-between' }}>
                <Typography variant="body2" color="text.secondary" sx={{ fontFamily: 'monospace', overflowWrap: 'anywhere', minWidth: 0 }}>
                    {value || 'Шаблон пока пуст'}
                </Typography>
                <Button size="small" onClick={() => onChange('')} disabled={!value} sx={{ alignSelf: { sm: 'center' } }}>Очистить</Button>
            </Stack>
        </Stack>
    )
}
