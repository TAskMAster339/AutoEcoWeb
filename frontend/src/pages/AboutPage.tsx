import type { ReactNode } from 'react'
import { Box, Card, Chip, Stack, Typography, useTheme } from '@mui/material'
import type { SxProps, Theme } from '@mui/material/styles'
import { alpha } from '@mui/material/styles'
import CalendarMonthOutlinedIcon from '@mui/icons-material/CalendarMonthOutlined'
import CompareArrowsOutlinedIcon from '@mui/icons-material/CompareArrowsOutlined'
import AccountBalanceWalletOutlinedIcon from '@mui/icons-material/AccountBalanceWalletOutlined'
import SwapHorizOutlinedIcon from '@mui/icons-material/SwapHorizOutlined'
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined'
import VpnKeyOutlinedIcon from '@mui/icons-material/VpnKeyOutlined'
import LabelOutlinedIcon from '@mui/icons-material/LabelOutlined'
import StorageOutlinedIcon from '@mui/icons-material/StorageOutlined'
import TrendingUpIcon from '@mui/icons-material/TrendingUp'
import TrendingDownIcon from '@mui/icons-material/TrendingDown'
import { PageHeader } from '../components/common/PageHeader'
import { colors, softBg, softFg } from '../theme'

function P({ children, sx }: { children: ReactNode; sx?: SxProps<Theme> }) {
  return (
    <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.55, mb: 1, ...sx }}>
      {children}
    </Typography>
  )
}

function Li({ children, sx }: { children: ReactNode; sx?: SxProps<Theme> }) {
  return (
    <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.55, display: 'flex', gap: 1, mb: 0.5, ...sx }}>
      <Box component="span" sx={{ color: 'primary.main', flexShrink: 0 }}>
        •
      </Box>
      <Box component="span">{children}</Box>
    </Typography>
  )
}

function Section({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  const theme = useTheme()
  return (
    <Card sx={{ p: 2.5, borderRadius: '8px' }}>
      <Stack direction="row" spacing={1.25} sx={{ alignItems: 'center', mb: 1.5 }}>
        <Box
          sx={{
            width: 32,
            height: 32,
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            bgcolor: softBg(theme),
            color: softFg(theme),
            flexShrink: 0,
          }}
        >
          {icon}
        </Box>
        <Typography sx={{ fontWeight: 700, fontSize: 15 }}>{title}</Typography>
      </Stack>
      {children}
    </Card>
  )
}

/** Справочная страница: как устроен учёт в AutoEco. */
export function AboutPage() {
  const theme = useTheme()
  const isDark = theme.palette.mode === 'dark'
  // Дельты: в тёмной теме — приглушённые подложки (alpha-заливка) и светлее текст.
  const deltaGreen = isDark ? '#4ADE80' : colors.green
  const deltaRed = isDark ? '#F87171' : colors.red
  const deltaGreenBg = isDark ? alpha(colors.green, 0.16) : colors.greenSoft
  const deltaRedBg = isDark ? alpha(colors.red, 0.16) : colors.redSoft

  return (
    <Stack spacing={2} sx={{ maxWidth: 760, mx: 'auto', width: '100%', pb: 2 }}>
      <PageHeader title="О приложении" subtitle="Как устроен учёт: периоды, дельты, баланс, операции" />

      <Section icon={<CalendarMonthOutlinedIcon sx={{ fontSize: 18 }} />} title="Периоды">
        <P>Выбор периода работает на страницах «Таблица», «Чеки» и в аналитике: выбранный диапазон применяется к списку операций, сводке и графикам.</P>
        <Li>«Этот месяц», «Прошлый месяц», «Последние 3 месяца» — быстрые пресеты.</Li>
        <Li>«Конкретный месяц…» — введите год (по умолчанию — текущий) и выберите один из 12 месяцев.</Li>
        <Li>«Свой период…» — произвольный диапазон дат.</Li>
        <Li>«Всё время» — без ограничения по датам.</Li>
        <P sx={{ mb: 0 }}>Выбранный период запоминается и восстанавливается при следующем визите.</P>
      </Section>

      <Section icon={<CompareArrowsOutlinedIcon sx={{ fontSize: 18 }} />} title="Дельты: красные и зелёные цифры">
        <P>Под суммами «Доходы» и «Расходы» в сводке показывается дельта — разница с предыдущим окном такой же длины:</P>
        <Li>«Этот месяц» сравнивается с прошлым месяцем.</Li>
        <Li>«Последние 3 месяца» — с тремя месяцами до этого.</Li>
        <Li>«Свой период» — с таким же диапазоном прямо перед ним.</Li>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', my: 1.5 }}>
          <Chip
            icon={<TrendingUpIcon sx={{ fontSize: 15 }} />}
            label="+8 901,24 ₽"
            size="small"
            sx={{ borderRadius: '6px', color: deltaGreen, bgcolor: deltaGreenBg, fontWeight: 700 }}
          />
          <Chip
            icon={<TrendingDownIcon sx={{ fontSize: 15 }} />}
            label="−310,34 ₽"
            size="small"
            sx={{ borderRadius: '6px', color: deltaRed, bgcolor: deltaRedBg, fontWeight: 700 }}
          />
        </Box>
        <P>Цвет зависит только от знака: зелёный — дельта ≥ 0, красный — дельта &lt; 0.</P>
        <P>Под «Доходами»: зелёное «+N ₽» — заработали больше, чем в предыдущем периоде; красное «−N ₽» — меньше.</P>
        <P>Под «Расходами» логика та же, поэтому красное число означает, что расходы снизились (это хорошо), а зелёное — что потратили больше.</P>
        <P>Для периода «Всё время» дельты не показываются: предыдущего окна не существует.</P>
        <P sx={{ mb: 0 }}>Под «Балансом» вместо дельты — спарклайн: накопленный баланс по дням внутри периода.</P>
      </Section>

      <Section icon={<AccountBalanceWalletOutlinedIcon sx={{ fontSize: 18 }} />} title="Баланс">
        <P>Баланс не хранится в базе — он вычисляется из всех операций: начальный остаток + доходы − расходы.</P>
        <P>Начальный остаток вносится как обычная операция дохода.</P>
        <P sx={{ mb: 0 }}>Карточка «Баланс» показывает остаток на конец выбранного периода, а линия рядом — как он менялся по дням.</P>
      </Section>

      <Section icon={<SwapHorizOutlinedIcon sx={{ fontSize: 18 }} />} title="Типы операций">
        <Li>«Расход» — покупка; «Доход» — зачисление; возвраты учитываются как доходные операции.</Li>
        <Li>У операции могут быть тег, магазин, количество и цена (для ручных) или привязка к чеку.</Li>
        <Li sx={{ mb: 0 }}>В таблице доходы и расходы разносятся по колонкам «Доход» / «Расход», итог попадает в «Баланс».</Li>
      </Section>

      <Section icon={<ReceiptLongOutlinedIcon sx={{ fontSize: 18 }} />} title="Чеки и ручные транзакции">
        <P>Чек попадает в учёт через сканер QR-кода (камера) или ручной ввод данных чека. Позиции чека превращаются в транзакции с привязкой к чеку.</P>
        <P>Ручная транзакция создаётся кнопкой «Добавить» и не связана с чеком: название, магазин, цена и количество вводятся вручную.</P>
        <P sx={{ mb: 0 }}>Раздел «Чеки» показывает отсканированные чеки, «Таблица» — все операции целиком.</P>
      </Section>

      <Section icon={<VpnKeyOutlinedIcon sx={{ fontSize: 18 }} />} title="Токен проверки чеков">
        <P>Для автоматической загрузки чека по QR-коду используется персональный токен сервиса proverkacheka.com (получение чека по QR-строке ФНС).</P>
        <Li>Получите токен в личном кабинете proverkacheka.com.</Li>
        <Li>Откройте «Настройки» → «Сервис чеков (proverkacheka)» и вставьте токен.</Li>
        <Li>Нажмите «Сохранить» — статус покажет «Токен настроен».</Li>
        <P sx={{ mb: 0 }}>Токен хранится только в вашем аккаунте и подставляется при сканировании QR-кода чека.</P>
      </Section>

      <Section icon={<LabelOutlinedIcon sx={{ fontSize: 18 }} />} title="Теги и правила">
        <P>Тег — категория операции (продукты, транспорт, связь…). Имя тега уникально, цвет задаётся из палитры.</P>
        <P sx={{ mb: 0 }}>
          «Правила» нормализуют названия магазинов при импорте чеков: правило вида «перекресток» → «Перекрёсток»
          (можно регулярное выражение), при совпадении нескольких правил применяется более приоритетное.
        </P>
      </Section>

      <Section icon={<StorageOutlinedIcon sx={{ fontSize: 18 }} />} title="Данные: импорт и экспорт">
        <P>Экспорт — все транзакции в Excel-файл: лист на каждый месяц, колонки Дата | Категория | Магазин | Описание | Доход | Расход.</P>
        <P sx={{ mb: 0 }}>
          Импорт — загрузка .xlsx/.csv в том же формате. Перед записью показывается предпросмотр с проверкой строк:
          строки с ошибками можно исключить, недостающие теги создаются автоматически.
        </P>
      </Section>

      <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'center', py: 1 }}>
        AutoEco — персональный учёт финансов
      </Typography>
    </Stack>
  )
}
