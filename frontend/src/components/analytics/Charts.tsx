import { useState } from 'react'
import { Box, Card, Stack, Typography, useTheme } from '@mui/material'
import {
    Bar,
    BarChart,
    CartesianGrid,
    Cell,
    Pie,
    PieChart,
    ReferenceLine,
    ResponsiveContainer,
    Tooltip as RechartsTooltip,
    XAxis,
    YAxis,
    Line as RechartsLine,
    LineChart as RechartsLineChart,
} from 'recharts'

/** Параметры рендера контента тултипа Recharts (payload — массив записей). */
type TipProps = {
    active?: boolean
    payload?: Array<{ payload?: unknown }>
}
/** Лениво разбираем первую запись тултипа Recharts в объект с полями. */
function firstTipPayload(props: TipProps): { [k: string]: unknown } | undefined {
    const entry = props.active && props.payload?.length ? props.payload[0] : undefined
    const p = entry?.payload
    return p && typeof p === 'object' ? (p as { [k: string]: unknown }) : undefined
}
import { formatShortDate } from '../../lib/format'

export function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <Card sx={{ p: 2.5, height: '100%' }}>
            <Typography variant="subtitle1" sx={{ mb: 1.5, fontWeight: 700 }}>
                {title}
            </Typography>
            {children}
        </Card>
    )
}

/* ------------------------------------------------------------------ */
/*  Analytics charts, built on Recharts (v3)                          */
/* ------------------------------------------------------------------ */

export interface TooltipRow {
    label: string
    value: string
    color?: string
}

/** Тема-aware карточка тултипа (общая для всех графиков). */
function TooltipCard({
    title,
    rows,
    style,
}: {
    title: string
    rows: TooltipRow[]
    style?: React.CSSProperties
}) {
    return (
        <Box
            sx={{
                bgcolor: 'background.paper',
                border: 1,
                borderColor: 'divider',
                borderRadius: '6px',
                boxShadow: 3,
                px: 1.5,
                py: 1,
                maxWidth: 260,
                ...style,
            }}
        >
            <Typography variant="caption" sx={{ fontWeight: 700, display: 'block', mb: 0.25 }}>
                {title}
            </Typography>
            {rows.map((r) => (
                <Box key={r.label} sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                    {r.color && <Box sx={{ width: 8, height: 8, borderRadius: '2px', bgcolor: r.color, flexShrink: 0 }} />}
                    <Typography variant="caption" color="text.secondary" sx={{ flex: 1 }}>
                        {r.label}
                    </Typography>
                    <Typography variant="caption" className="tnum" sx={{ fontWeight: 600 }}>
                        {r.value}
                    </Typography>
                </Box>
            ))}
        </Box>
    )
}

/** Компактная подпись значений оси Y («5 тыс», «1,2 М»). */
function compactAxisValue(v: number): string {
    const abs = Math.abs(v)
    if (abs >= 1_000_000) return `${(v / 1_000_000).toLocaleString('ru-RU', { maximumFractionDigits: 1 })} М`
    if (abs >= 1000) return `${(v / 1000).toLocaleString('ru-RU', { maximumFractionDigits: 1 })} тыс`
    return String(Math.round(v))
}

export interface LinePoint {
    /** индекс точки (0..n-1) — ось X */
    x: number
    /** подпись (например, день) */
    label: string
    value: number
    color?: string
    /** доп. строки тултипа */
    meta?: TooltipRow[]
}

interface LineChartProps {
    points: LinePoint[]
    /** значения тренда (МНК), выровнены с points; null — пропуск */
    trend?: Array<number | null>
    /** горизонтальная линия медианы */
    median?: number | null
    medianLabel?: string
    formatValue: (v: number) => string
    /** подпись значения в тултипе */
    valueLabel?: string
    /** от 0 (расходы) или по данным (цены) */
    zeroBased?: boolean
    ariaLabel?: string
}

/** Кривая с точками, трендом, медианой и тултипом (Recharts). */
export function LineChart({
    points,
    trend,
    median,
    medianLabel,
    formatValue,
    valueLabel = 'Значение',
    zeroBased = true,
    ariaLabel = 'График',
}: LineChartProps) {
    const theme = useTheme()
    const grid = theme.palette.divider
    const textSecondary = theme.palette.text.secondary
    const paper = theme.palette.background.paper

    const data = points.map((p, i) => ({ ...p, trend: trend?.[i] ?? null }))
    const rawMax = points.length ? Math.max(...points.map((p) => p.value)) : 0
    const rawMin = points.length ? Math.min(...points.map((p) => p.value)) : 0
    const pad = Math.max((rawMax - rawMin) * 0.1, 1)
    const labelEvery = Math.max(1, Math.ceil(points.length / 8))

    if (points.length === 0) {
        return <EmptyChart text="Нет данных за период" ariaLabel={ariaLabel} />
    }

    const renderDot = (props: { cx?: number; cy?: number; payload?: { color?: string } }) => {
        if (props.cx === undefined || props.cy === undefined) return null
        return (
            <circle
                cx={props.cx}
                cy={props.cy}
                r={3.5}
                fill={props.payload?.color ?? theme.palette.primary.main}
                stroke={paper}
                strokeWidth={1.5}
            />
        )
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const lineTooltip = (props: any) => {
        const point = firstTipPayload(props)
        if (!point) return null
        return (
            <TooltipCard
                title={String(point.label ?? '')}
                rows={[
                    { label: valueLabel, value: formatValue(Number(point.value ?? 0)), color: point.color as string | undefined },
                    ...((point.meta as TooltipRow[] | undefined) ?? []),
                ]}
            />
        )
    }

    return (
        <Box sx={{ position: 'relative', width: '100%', height: 220 }} role="img" aria-label={ariaLabel}>
            <ResponsiveContainer width="100%" height="100%">
                <RechartsLineChart data={data} margin={{ top: 16, right: 8, bottom: 4, left: 4 }} accessibilityLayer={false}>
                    <CartesianGrid stroke={grid} strokeDasharray="3 3" vertical={false} />
                    <XAxis
                        dataKey="label"
                        tickFormatter={(v: string, i: number) => (i % labelEvery === 0 ? formatShortDate(v) : '')}
                        tick={{ fontSize: 10, fill: textSecondary }}
                        tickLine={false}
                        axisLine={false}
                        interval={0}
                        height={24}
                    />
                    <YAxis
                        domain={zeroBased ? [0, 'auto'] : [rawMin - pad, rawMax + pad]}
                        allowDataOverflow
                        tickFormatter={compactAxisValue}
                        tick={{ fontSize: 10, fill: textSecondary }}
                        tickLine={false}
                        axisLine={false}
                        width={52}
                    />
                    {median !== null && median !== undefined && (
                        <ReferenceLine
                            y={median}
                            stroke={textSecondary}
                            strokeDasharray="4 4"
                            label={{
                                value: medianLabel,
                                position: 'right',
                                fill: textSecondary,
                                fontSize: 10,
                                offset: 2,
                            }}
                        />
                    )}
                    <RechartsTooltip
                        content={lineTooltip}
                        cursor={{ stroke: textSecondary, strokeDasharray: '3 3' }}
                        offset={10}
                    />
                    {trend && trend.length === points.length && (
                        <RechartsLine
                            type="monotone"
                            dataKey="trend"
                            stroke={theme.palette.primary.main}
                            strokeWidth={1.5}
                            strokeDasharray="5 4"
                            dot={false}
                            activeDot={false}
                            connectNulls
                        />
                    )}
                    <RechartsLine
                        type="monotone"
                        dataKey="value"
                        stroke={theme.palette.primary.main}
                        strokeWidth={2}
                        strokeLinecap="round"
                        dot={renderDot}
                        activeDot={{ r: 5, stroke: paper, strokeWidth: 1.5, fill: theme.palette.primary.main }}
                        connectNulls
                    />
                </RechartsLineChart>
            </ResponsiveContainer>
        </Box>
    )
}

export interface DonutItem {
    label: string
    value: number
    color: string
    /** id для клика-перехода (например, id тега категории) */
    id?: string
    /** слитые в «Другое» элементы — клик по секции выбирает все оставшиеся */
    others?: DonutItem[]
}

interface DonutChartProps {
    items: DonutItem[]
    formatValue: (v: number) => string
    /** подпись под суммой в центре */
    centerLabel?: string
    /** скрыть сектора с нулевым значением (по умолчанию да) */
    dropZeros?: boolean
    /** обработчик клика по элементу; null/undefined — некликабельный элемент */
    getItemClick?: (item: DonutItem) => (() => void) | null | undefined
}

/** Кольцевая диаграмма: %, точные суммы в легенде, тултип за курсором (Recharts). */
export function DonutChart({ items, formatValue, centerLabel = 'всего', dropZeros = true, getItemClick }: DonutChartProps) {
    const [active, setActive] = useState<number | null>(null)
    const [tip, setTip] = useState<{ x: number; y: number; item: DonutItem } | null>(null)

    const data = dropZeros ? items.filter((i) => i.value > 0) : items
    const total = data.reduce((s, i) => s + i.value, 0)
    if (total <= 0) {
        return <EmptyChart text="Нет данных за период" ariaLabel="Круговая диаграмма" />
    }

    // Recharts' Tooltip ставит карточку в центре сектора (= центр кольца),
    // где лежит сумма — перекрывает её. Поэтому рисуем свой тултип,
    // следующий за курсором (viewport-координаты из события мыши).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tipRows = (item: DonutItem): TooltipRow[] => {
        const pct = ((item.value / total) * 100).toFixed(1)
        return [
            { label: 'Сумма', value: formatValue(item.value), color: item.color },
            { label: 'Доля', value: `${pct}%` },
        ]
    }

    const showTip = (i: number, clientX: number, clientY: number) => {
        const item = data[i]!
        setActive(i)
        setTip({ x: clientX, y: clientY, item })
    }

    const handleSegmentClick = (item?: DonutItem) => {
        const onClick = item ? getItemClick?.(item) : undefined
        onClick?.()
    }

    return (
        <Box
            sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1.5 }}
            onMouseLeave={() => { setActive(null); setTip(null) }}
        >
            <Box sx={{ position: 'relative', width: 168, height: 168, flexShrink: 0 }}>
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart accessibilityLayer={false}>
                        <Pie
                            data={data}
                            dataKey="value"
                            nameKey="label"
                            cx="50%"
                            cy="50%"
                            innerRadius={62}
                            outerRadius={82}
                            paddingAngle={data.length > 1 ? 2 : 0}
                            stroke="none"
                            isAnimationActive={false}
                            onMouseEnter={(_, i, e) => showTip(i, e.clientX, e.clientY)}
                            onMouseMove={(_, i, e) => showTip(i, e.clientX, e.clientY)}
                            onClick={(_, i) => handleSegmentClick(data[i])}
                        >
                            {data.map((item, i) => (
                                <Cell
                                    key={item.label}
                                    fill={item.color}
                                    opacity={active === null || active === i ? 1 : 0.3}
                                    cursor={getItemClick?.(item) ? 'pointer' : 'default'}
                                />
                            ))}
                        </Pie>
                    </PieChart>
                </ResponsiveContainer>
                <Box
                    sx={{
                        position: 'absolute',
                        inset: 0,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        pointerEvents: 'none',
                    }}
                >
                    <Typography className="tnum" sx={{ fontSize: 17, fontWeight: 700, letterSpacing: '-0.02em' }}>
                        {formatValue(total)}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                        {centerLabel}
                    </Typography>
                </Box>
            </Box>

            {tip && (
                <TooltipCard
                    title={tip.item.label}
                    rows={tipRows(tip.item)}
                    style={{ position: 'fixed', left: tip.x + 14, top: tip.y + 14, zIndex: 1300, pointerEvents: 'none' }}
                />
            )}

            <Stack spacing={0.5} sx={{ width: '100%', maxWidth: 300 }}>
                {data.map((item, i) => {
                    const pct = ((item.value / total) * 100).toFixed(1)
                    const onClick = getItemClick?.(item)
                    return (
                        <Box
                            key={item.label}
                            role={onClick ? 'button' : undefined}
                            tabIndex={onClick ? 0 : undefined}
                            onClick={onClick ?? undefined}
                            onKeyDown={
                                onClick
                                    ? (e) => {
                                        if (e.key === 'Enter' || e.key === ' ') {
                                            e.preventDefault()
                                            onClick()
                                        }
                                    }
                                    : undefined
                            }
                            sx={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 0.75,
                                opacity: active === null || active === i ? 1 : 0.45,
                                cursor: onClick ? 'pointer' : 'default',
                                borderRadius: '6px',
                                px: 0.75,
                                mx: -0.75,
                                '&:hover': onClick ? { bgcolor: 'action.hover' } : undefined,
                            }}
                        >
                            <Box sx={{ width: 8, height: 8, borderRadius: '2px', bgcolor: item.color, flexShrink: 0 }} />
                            <Typography variant="body2" sx={{ flex: 1, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {item.label}
                            </Typography>
                            <Typography variant="caption" className="tnum" color="text.secondary" sx={{ fontWeight: 600 }}>
                                {pct}%
                            </Typography>
                        </Box>
                    )
                })}
            </Stack>
        </Box>
    )
}

export interface WeekdayBar {
    /** 1..7, ISO (1 = Пн) */
    weekday: number
    value: number
    count: number
}

interface WeekdayBarsProps {
    data: WeekdayBar[]
    formatValue: (v: number) => string
}

const WEEKDAY_LABELS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']

/** Палитра дней недели — без фиолетового (не сливается с акцентом). */
const WEEKDAY_COLORS = ['#2563EB', '#0EA5E9', '#14B8A6', '#10B981', '#84CC16', '#F59E0B', '#EF4444']

export function weekdayLabel(weekday: number): string {
    return WEEKDAY_LABELS[weekday - 1] ?? '—'
}

/** Столбчатая диаграмма трат по дням недели (всегда 7 столбцов, Recharts). */
export function WeekdayBars({ data, formatValue }: WeekdayBarsProps) {
    const theme = useTheme()
    const grid = theme.palette.divider
    const textSecondary = theme.palette.text.secondary

    const bars = WEEKDAY_LABELS.map((label, i) => {
        const d = data.find((x) => x.weekday === i + 1)
        // Цвет дня — свой, даже при нулевых тратах (но нейтральный, не акцентный)
        return { label, value: d?.value ?? 0, count: d?.count ?? 0, weekday: i + 1, fill: WEEKDAY_COLORS[i]! }
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const barTooltip = (props: any) => {
        const b = firstTipPayload(props)
        if (!b || typeof b.value !== 'number' || b.value <= 0) return null
        return (
            <TooltipCard
                title={String(b.label ?? '')}
                rows={[
                    { label: 'Сумма', value: formatValue(b.value) },
                    { label: 'Операций', value: String(b.count ?? '') },
                ]}
            />
        )
    }

    return (
        <Box sx={{ position: 'relative', width: '100%', height: 200 }} role="img" aria-label="Траты по дням недели">
            <ResponsiveContainer width="100%" height="100%">
                <BarChart data={bars} margin={{ top: 16, right: 8, bottom: 0, left: 4 }} accessibilityLayer={false}>
                    <CartesianGrid stroke={grid} strokeDasharray="3 3" vertical={false} />
                    <XAxis
                        dataKey="label"
                        tick={{ fontSize: 10, fill: textSecondary }}
                        tickLine={false}
                        axisLine={false}
                        interval={0}
                    />
                    <YAxis
                        tickFormatter={compactAxisValue}
                        tick={{ fontSize: 10, fill: textSecondary }}
                        tickLine={false}
                        axisLine={false}
                        width={52}
                    />
                    <RechartsTooltip content={barTooltip} cursor={{ fill: 'transparent' }} />
                    <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={34} isAnimationActive={false}>
                        {bars.map((b) => (
                            <Cell key={b.label} fill={b.value > 0 ? b.fill : '#EDEDF4'} />
                        ))}
                    </Bar>
                </BarChart>
            </ResponsiveContainer>
        </Box>
    )
}

/** Пустой график-заглушка. */
export function EmptyChart({ text, ariaLabel }: { text: string; ariaLabel: string }) {
    return (
        <Box
            role="img"
            aria-label={ariaLabel}
            sx={{
                height: 180,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1px dashed',
                borderColor: 'divider',
                borderRadius: '8px',
            }}
        >
            <Typography variant="body2" color="text.secondary">
                {text}
            </Typography>
        </Box>
    )
}

/** Детерминированная палитра для магазинов (индекс в массиве stores).
 *  Без фиолетовых — они сливаются с акцентным цветом приложения. */
export const STORE_COLORS = [
    '#2563EB', '#0EA5E9', '#10B981', '#84CC16', '#F59E0B',
    '#F97316', '#EF4444', '#14B8A6', '#EC4899', '#64748B',
] as const

export function storeColor(index: number): string {
    return STORE_COLORS[index % STORE_COLORS.length]!
}

/** Нейтральный цвет секции «Другое» (слитые доли < 1 %). */
export const OTHER_SLICE_COLOR = '#64748B'

/** Объединяет доли меньше minFraction от суммы в одну секцию «Другое».
 *  Сумма не меняется; порядок — по убыванию. Если всё < 1 %, крупнейшая
 *  доля остаётся отдельной, чтобы пирог не вырождался в одно кольцо.
 *  Слитая секция несёт исходные элементы в `others` — для мульти-фильтра. */
export function mergeSmallSlices<T extends { label: string; value: number }>(
    items: readonly T[],
    minFraction = 0.01,
): (T & { others?: T[] })[] {
    if (items.length <= 1) return [...items]
    const total = items.reduce((s, i) => s + i.value, 0)
    if (total <= 0) return [...items]
    const sorted = [...items].sort((a, b) => b.value - a.value)
    const big = sorted.filter((i) => i.value / total >= minFraction)
    const small = sorted.filter((i) => i.value / total < minFraction)
    if (small.length === 0) return sorted
    const keep = big.length > 0 ? big : [sorted[0]!]
    const rest = big.length > 0 ? small : sorted.slice(1)
    const otherSum = rest.reduce((s, i) => s + i.value, 0)
    if (otherSum <= 0) return sorted
    return [...keep, { ...(rest[0] ?? sorted[0]!), label: 'Другое', value: otherSum, others: rest }]
}
