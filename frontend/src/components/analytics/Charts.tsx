import { useState } from 'react'
import { Box, Card, Stack, Typography, useTheme } from '@mui/material'
import { formatCurrency, formatShortDate } from '../../lib/format'
import { colors } from '../../theme'
import type { AnalyticsDaily } from '../../api/types'

interface BarChartProps {
  data: AnalyticsDaily[]
}

/** Hand-rolled SVG bar chart — expenses by day, purple bars (mockup style). */
export function BarChart({ data }: BarChartProps) {
  const w = 640
  const h = 220
  const pad = { top: 12, right: 8, bottom: 28, left: 8 }
  const innerW = w - pad.left - pad.right
  const innerH = h - pad.top - pad.bottom

  const max = Math.max(...data.map((d) => d.expenses), 1)
  const step = innerW / Math.max(data.length, 1)
  const barW = Math.min(22, step * 0.55)

  // label every ~4th day
  const labelEvery = Math.max(1, Math.ceil(data.length / 8))

  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', height: 'auto', display: 'block' }} role="img" aria-label="Расходы по дням">
      {[0.25, 0.5, 0.75, 1].map((f) => (
        <line
          key={f}
          x1={pad.left}
          x2={w - pad.right}
          y1={pad.top + innerH * (1 - f)}
          y2={pad.top + innerH * (1 - f)}
          stroke="#F1F1F6"
          strokeWidth={1}
        />
      ))}
      {data.map((d, i) => {
        const x = pad.left + i * step + (step - barW) / 2
        const barH = (d.expenses / max) * innerH
        const y = pad.top + innerH - barH
        return (
          <g key={d.day}>
            <rect x={x} y={y} width={barW} height={Math.max(barH, d.expenses > 0 ? 2 : 0)} rx={4} fill={d.expenses > 0 ? colors.primary : '#EDEDF4'} />
            {i % labelEvery === 0 && (
              <text x={x + barW / 2} y={h - 8} textAnchor="middle" fontSize={10} fill={colors.textSecondary}>
                {formatShortDate(d.day)}
              </text>
            )}
          </g>
        )
      })}
      <text x={pad.left} y={pad.top - 4} fontSize={10} fill={colors.textSecondary}>
        макс {formatCurrency(max)}
      </text>
    </svg>
  )
}

interface HorizontalBarsProps {
  items: Array<{ label: string; value: number; color?: string }>
}

/** Horizontal proportion bars — by store / by tag. */
export function HorizontalBars({ items }: HorizontalBarsProps) {
  const max = Math.max(...items.map((i) => i.value), 1)
  return (
    <Stack spacing={1.25}>
      {items.map((item) => (
        <Box key={item.label}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.35 }}>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              {item.label}
            </Typography>
            <Typography variant="body2" className="tnum" color="text.secondary">
              {formatCurrency(item.value)}
            </Typography>
          </Box>
          <Box sx={{ height: 8, borderRadius: 99, bgcolor: '#F1F1F6', overflow: 'hidden' }}>
            <Box
              sx={{
                width: `${(item.value / max) * 100}%`,
                height: '100%',
                borderRadius: 99,
                bgcolor: item.color ?? colors.primary,
              }}
            />
          </Box>
        </Box>
      ))}
    </Stack>
  )
}

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
/*  Analytics v2: line / donut / weekday charts + shared tooltip       */
/* ------------------------------------------------------------------ */

export interface TooltipRow {
  label: string
  value: string
  color?: string
}

interface ChartTooltipProps {
  anchor: { x: number; y: number } | null
  title: string
  rows: TooltipRow[]
}

/** Тултип-карточка за курсором (viewport-координаты из событий мыши). */
export function ChartTooltip({ anchor, title, rows }: ChartTooltipProps) {
  if (!anchor) return null
  return (
    <Box
      sx={{
        position: 'fixed',
        left: anchor.x + 14,
        top: anchor.y + 14,
        zIndex: 1300,
        bgcolor: 'background.paper',
        border: 1,
        borderColor: 'divider',
        borderRadius: '6px',
        boxShadow: 3,
        px: 1.5,
        py: 1,
        pointerEvents: 'none',
        maxWidth: 260,
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

/** Кривая с точками, трендом, медианой и тултипом (Catmull-Rom → bezier). */
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
  const [tip, setTip] = useState<{ anchor: { x: number; y: number }; title: string; rows: TooltipRow[] } | null>(null)

  const w = 640
  const h = 220
  const pad = { top: 14, right: 64, bottom: 26, left: 8 }
  const innerW = w - pad.left - pad.right
  const innerH = h - pad.top - pad.bottom

  const values = points.map((p) => p.value)
  if (values.length === 0) {
    return <EmptyChart text="Нет данных за период" ariaLabel={ariaLabel} />
  }
  const rawMax = Math.max(...values)
  const rawMin = Math.min(...values)
  const min = zeroBased ? 0 : Math.min(0, rawMin) === rawMin ? rawMin - Math.max((rawMax - rawMin) * 0.1, 1) : rawMin
  const max = zeroBased ? Math.max(rawMax, 1) : rawMax + Math.max((rawMax - rawMin) * 0.1, 1)
  const span = max - min || 1
  const step = points.length > 1 ? innerW / (points.length - 1) : 0

  const xOf = (i: number) => (points.length > 1 ? pad.left + i * step : pad.left + innerW / 2)
  const yOf = (v: number) => pad.top + innerH * (1 - (v - min) / span)

  const pts = points.map((p, i) => ({ x: xOf(i), y: yOf(p.value) }))
  const path = smoothPath(pts)

  const labelEvery = Math.max(1, Math.ceil(points.length / 8))
  const grid = theme.palette.divider

  const medianY = median !== null && median !== undefined ? yOf(median) : null

  return (
    <Box sx={{ position: 'relative' }}>
      <svg
        viewBox={`0 0 ${w} ${h}`}
        style={{ width: '100%', height: 'auto', display: 'block' }}
        role="img"
        aria-label={ariaLabel}
        onMouseLeave={() => setTip(null)}
      >
        {[0.25, 0.5, 0.75, 1].map((f) => (
          <line
            key={f}
            x1={pad.left}
            x2={w - pad.right}
            y1={pad.top + innerH * (1 - f)}
            y2={pad.top + innerH * (1 - f)}
            stroke={grid}
            strokeWidth={1}
          />
        ))}

        {medianY !== null && (
          <g>
            <line
              x1={pad.left}
              x2={w - pad.right - 2}
              y1={medianY}
              y2={medianY}
              stroke={theme.palette.text.secondary}
              strokeWidth={1.5}
              strokeDasharray="4 4"
            />
            {medianLabel && (
              <text x={w - pad.right + 4} y={medianY + 3} fontSize={10} fill={theme.palette.text.secondary}>
                {medianLabel}
              </text>
            )}
          </g>
        )}

        {trend && trend.length === points.length && (
          <path
            d={smoothPath(
              trend.map((t, i) => {
                const pt = points[i]!
                return { x: xOf(i), y: t === null ? yOf(pt.value) : yOf(t) }
              }),
            )}
            fill="none"
            stroke={theme.palette.primary.main}
            strokeWidth={1.5}
            strokeDasharray="5 4"
            opacity={0.85}
          />
        )}

        <path d={path} fill="none" stroke={theme.palette.primary.main} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />

        {points.map((p, i) => {
          const color = p.color ?? theme.palette.primary.main
          const cx = xOf(i)
          const cy = yOf(p.value)
          return (
            <g key={`${p.label}-${i}`}>
              <circle cx={cx} cy={cy} r={3.5} fill={color} stroke={theme.palette.background.paper} strokeWidth={1.5} />
              <circle
                cx={cx}
                cy={cy}
                r={11}
                fill="transparent"
                style={{ cursor: 'pointer' }}
                onMouseEnter={(e) => setTip({ anchor: { x: e.clientX, y: e.clientY }, title: p.label, rows: buildTipRows(p, formatValue, valueLabel) })}
                onMouseMove={(e) => setTip((t) => (t ? { ...t, anchor: { x: e.clientX, y: e.clientY } } : t))}
              />
            </g>
          )
        })}

        {points.map((p, i) =>
          i % labelEvery === 0 ? (
            <text key={`lbl-${i}`} x={xOf(i)} y={h - 8} textAnchor="middle" fontSize={10} fill={theme.palette.text.secondary}>
              {formatShortDate(p.label)}
            </text>
          ) : null,
        )}

        <text x={pad.left} y={pad.top - 4} fontSize={10} fill={theme.palette.text.secondary}>
          макс {formatValue(max)}
        </text>
      </svg>
      <ChartTooltip anchor={tip?.anchor ?? null} title={tip?.title ?? ''} rows={tip?.rows ?? []} />
    </Box>
  )
}

function buildTipRows(p: LinePoint, formatValue: (v: number) => string, valueLabel: string): TooltipRow[] {
  return [
    { label: valueLabel, value: formatValue(p.value), color: p.color },
    ...(p.meta ?? []),
  ]
}

/** Catmull-Rom → кубические безье: плавная кривая через точки. */
function smoothPath(pts: Array<{ x: number; y: number }>): string {
  if (pts.length === 0) return ''
  if (pts.length === 1) return `M${pts[0]!.x.toFixed(1)},${pts[0]!.y.toFixed(1)}`
  let d = `M${pts[0]!.x.toFixed(1)},${pts[0]!.y.toFixed(1)}`
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)]!
    const p1 = pts[i]!
    const p2 = pts[i + 1]!
    const p3 = pts[Math.min(pts.length - 1, i + 2)]!
    const c1x = p1.x + (p2.x - p0.x) / 6
    const c1y = p1.y + (p2.y - p0.y) / 6
    const c2x = p2.x - (p3.x - p1.x) / 6
    const c2y = p2.y - (p3.y - p1.y) / 6
    d += ` C${c1x.toFixed(1)},${c1y.toFixed(1)} ${c2x.toFixed(1)},${c2y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`
  }
  return d
}

export interface DonutItem {
  label: string
  value: number
  color: string
}

interface DonutChartProps {
  items: DonutItem[]
  formatValue: (v: number) => string
  /** подпись под суммой в центре */
  centerLabel?: string
  /** скрыть сектора с нулевым значением (по умолчанию да) */
  dropZeros?: boolean
}

/** Кольцевая диаграмма: %, точные суммы в легенде, тултип на секторе. */
export function DonutChart({ items, formatValue, centerLabel = 'всего', dropZeros = true }: DonutChartProps) {
  const [active, setActive] = useState<number | null>(null)
  const [tip, setTip] = useState<{ anchor: { x: number; y: number }; title: string; rows: TooltipRow[] } | null>(null)

  const data = dropZeros ? items.filter((i) => i.value > 0) : items
  const total = data.reduce((s, i) => s + i.value, 0)
  if (total <= 0) {
    return <EmptyChart text="Нет данных за период" ariaLabel="Круговая диаграмма" />
  }

  const size = 168
  const rOuter = size / 2 - 4
  const rInner = rOuter * 0.62
  const cx = size / 2
  const cy = size / 2
  const gap = data.length > 1 ? 0.025 : 0
  let angle = -Math.PI / 2

  const segments = data.map((item) => {
    const sweep = (item.value / total) * Math.PI * 2
    const seg = { item, a0: angle + gap / 2, a1: angle + sweep - gap / 2 }
    angle += sweep
    return seg
  })

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }} onMouseLeave={() => { setActive(null); setTip(null) }}>
      <Box sx={{ position: 'relative', flexShrink: 0 }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Круговая диаграмма">
          {segments.map(({ item, a0, a1 }, i) => (
            <path
              key={item.label}
              d={arcPath(cx, cy, rInner, rOuter, a0, a1)}
              fill={item.color}
              opacity={active === null || active === i ? 1 : 0.3}
              style={{ cursor: 'pointer', transition: 'opacity 0.15s' }}
              onMouseEnter={(e) => {
                setActive(i)
                const pct = ((item.value / total) * 100).toFixed(1)
                setTip({
                  anchor: { x: e.clientX, y: e.clientY },
                  title: item.label,
                  rows: [
                    { label: 'Сумма', value: formatValue(item.value), color: item.color },
                    { label: 'Доля', value: `${pct}%` },
                  ],
                })
              }}
              onMouseMove={(e) => setTip((t) => (t ? { ...t, anchor: { x: e.clientX, y: e.clientY } } : t))}
            />
          ))}
        </svg>
        <Box sx={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
          <Typography className="tnum" sx={{ fontSize: 17, fontWeight: 700, letterSpacing: '-0.02em' }}>
            {formatValue(total)}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {centerLabel}
          </Typography>
        </Box>
      </Box>

      <Stack spacing={0.5} sx={{ flex: 1, minWidth: 140 }}>
        {segments.map(({ item }, i) => {
          const pct = ((item.value / total) * 100).toFixed(1)
          return (
            <Box
              key={item.label}
              sx={{ display: 'flex', alignItems: 'center', gap: 0.75, opacity: active === null || active === i ? 1 : 0.45 }}
              onMouseEnter={(e) => {
                setActive(i)
                setTip({
                  anchor: { x: e.clientX, y: e.clientY },
                  title: item.label,
                  rows: [
                    { label: 'Сумма', value: formatValue(item.value), color: item.color },
                    { label: 'Доля', value: `${pct}%` },
                  ],
                })
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
      <ChartTooltip anchor={tip?.anchor ?? null} title={tip?.title ?? ''} rows={tip?.rows ?? []} />
    </Box>
  )
}

/** Сектор кольца от a0 до a1 (радианы, 0 = 3 часа). */
function arcPath(cx: number, cy: number, r1: number, r2: number, a0: number, a1: number): string {
  const large = a1 - a0 > Math.PI ? 1 : 0
  const p0x = cx + r1 * Math.cos(a0)
  const p0y = cy + r1 * Math.sin(a0)
  const p1x = cx + r2 * Math.cos(a1)
  const p1y = cy + r2 * Math.sin(a1)
  const p2x = cx + r1 * Math.cos(a1)
  const p2y = cy + r1 * Math.sin(a1)
  const p3x = cx + r2 * Math.cos(a0)
  const p3y = cy + r2 * Math.sin(a0)
  return (
    `M${p0x.toFixed(2)},${p0y.toFixed(2)} ` +
    `L${p3x.toFixed(2)},${p3y.toFixed(2)} ` +
    `A${r2.toFixed(2)},${r2.toFixed(2)} 0 ${large} 1 ${p1x.toFixed(2)},${p1y.toFixed(2)} ` +
    `L${p2x.toFixed(2)},${p2y.toFixed(2)} ` +
    `A${r1.toFixed(2)},${r1.toFixed(2)} 0 ${large} 0 ${p0x.toFixed(2)},${p0y.toFixed(2)} Z`
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

export function weekdayLabel(weekday: number): string {
  return WEEKDAY_LABELS[weekday - 1] ?? '—'
}

/** Столбчатая диаграмма трат по дням недели (всегда 7 столбцов). */
export function WeekdayBars({ data, formatValue }: WeekdayBarsProps) {
  const theme = useTheme()
  const [tip, setTip] = useState<{ anchor: { x: number; y: number }; title: string; rows: TooltipRow[] } | null>(null)

  const w = 640
  const h = 200
  const pad = { top: 14, right: 8, bottom: 30, left: 8 }
  const innerW = w - pad.left - pad.right
  const innerH = h - pad.top - pad.bottom

  const bars = WEEKDAY_LABELS.map((label, i) => {
    const d = data.find((x) => x.weekday === i + 1)
    return { label, value: d?.value ?? 0, count: d?.count ?? 0 }
  })
  const max = Math.max(...bars.map((b) => b.value), 1)
  const step = innerW / 7
  const barW = Math.min(34, step * 0.5)
  const grid = theme.palette.divider

  return (
    <Box sx={{ position: 'relative' }} onMouseLeave={() => setTip(null)}>
      <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', height: 'auto', display: 'block' }} role="img" aria-label="Траты по дням недели">
        {[0.25, 0.5, 0.75, 1].map((f) => (
          <line
            key={f}
            x1={pad.left}
            x2={w - pad.right}
            y1={pad.top + innerH * (1 - f)}
            y2={pad.top + innerH * (1 - f)}
            stroke={grid}
            strokeWidth={1}
          />
        ))}
        {bars.map((b, i) => {
          const x = pad.left + i * step + (step - barW) / 2
          const barH = (b.value / max) * innerH
          const y = pad.top + innerH - barH
          return (
            <g key={b.label}>
              <rect
                x={x}
                y={y}
                width={barW}
                height={Math.max(barH, b.value > 0 ? 2 : 0)}
                rx={4}
                fill={b.value > 0 ? theme.palette.primary.main : '#EDEDF4'}
                style={{ cursor: b.value > 0 ? 'pointer' : 'default' }}
                onMouseEnter={(e) => {
                  if (b.value <= 0) return
                  setTip({
                    anchor: { x: e.clientX, y: e.clientY },
                    title: b.label,
                    rows: [
                      { label: 'Сумма', value: formatValue(b.value) },
                      { label: 'Операций', value: String(b.count) },
                    ],
                  })
                }}
                onMouseMove={(e) => setTip((t) => (t ? { ...t, anchor: { x: e.clientX, y: e.clientY } } : t))}
              />
              <text x={x + barW / 2} y={h - 8} textAnchor="middle" fontSize={10} fill={theme.palette.text.secondary}>
                {b.label}
              </text>
            </g>
          )
        })}
        <text x={pad.left} y={pad.top - 4} fontSize={10} fill={theme.palette.text.secondary}>
          макс {formatValue(max)}
        </text>
      </svg>
      <ChartTooltip anchor={tip?.anchor ?? null} title={tip?.title ?? ''} rows={tip?.rows ?? []} />
    </Box>
  )
}

/** Пустой график-заглушка. */
function EmptyChart({ text, ariaLabel }: { text: string; ariaLabel: string }) {
  return (
    <Box
      role="img"
      aria-label={ariaLabel}
      sx={{
        height: 180,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        border: 1,
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

/** Детерминированная палитра для магазинов (индекс в массиве stores). */
export const STORE_COLORS = [
  '#6C5CE7', '#3B82F6', '#10B981', '#F59E0B', '#EF4444',
  '#8B5CF6', '#06B6D4', '#EC4899', '#84CC16', '#F97316',
] as const

export function storeColor(index: number): string {
  return STORE_COLORS[index % STORE_COLORS.length]!
}
