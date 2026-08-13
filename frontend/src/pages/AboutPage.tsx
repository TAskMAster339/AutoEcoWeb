import type { ReactNode } from 'react'
import {
  Alert,
  Box,
  Card,
  Chip,
  Divider,
  Link,
  Stack,
  Typography,
  useTheme,
} from '@mui/material'
import { Link as RouterLink, Navigate, useParams } from 'react-router-dom'
import RocketLaunchOutlinedIcon from '@mui/icons-material/RocketLaunchOutlined'
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined'
import StorageOutlinedIcon from '@mui/icons-material/StorageOutlined'
import CalculateOutlinedIcon from '@mui/icons-material/CalculateOutlined'
import DataObjectOutlinedIcon from '@mui/icons-material/DataObjectOutlined'
import ImportExportOutlinedIcon from '@mui/icons-material/ImportExportOutlined'
import ArrowForwardOutlinedIcon from '@mui/icons-material/ArrowForwardOutlined'
import SecurityOutlinedIcon from '@mui/icons-material/SecurityOutlined'
import { PageHeader } from '../components/common/PageHeader'
import { softBg, softFg } from '../theme'

const GUIDE_PAGES = [
  { slug: 'quick-start', title: 'Быстрый старт', description: 'Настройте аккаунт и добавьте первый чек', icon: RocketLaunchOutlinedIcon },
  { slug: 'receipts', title: 'Откуда берутся чеки', description: 'ФНС, «Проверка чеков» и QR-код', icon: ReceiptLongOutlinedIcon },
  { slug: 'storage', title: 'Как хранятся данные', description: 'Чеки, операции и ключ сервиса', icon: StorageOutlinedIcon },
  { slug: 'math', title: 'Немного математики', description: 'Баланс, периоды и сравнение', icon: CalculateOutlinedIcon },
  { slug: 'regex', title: 'Правила и regex', description: 'Как приводить названия к одному виду', icon: DataObjectOutlinedIcon },
  { slug: 'data', title: 'Импорт и экспорт', description: 'Перенос данных и резервная копия', icon: ImportExportOutlinedIcon },
] as const

type GuideSlug = (typeof GUIDE_PAGES)[number]['slug']

function Text({ children }: { children: ReactNode }) {
  return <Typography color="text.secondary" sx={{ lineHeight: 1.75 }}>{children}</Typography>
}

function Bullet({ children }: { children: ReactNode }) {
  return (
    <Box sx={{ display: 'flex', gap: 1.25, alignItems: 'flex-start' }}>
      <Box sx={{ width: 6, height: 6, borderRadius: '2px', bgcolor: 'primary.main', mt: 1.1, flexShrink: 0 }} />
      <Text>{children}</Text>
    </Box>
  )
}

function GuideSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Stack component="section" spacing={1.25}>
      <Typography variant="h6" sx={{ fontSize: 18 }}>{title}</Typography>
      {children}
    </Stack>
  )
}

function Code({ children }: { children: ReactNode }) {
  return (
    <Box
      component="code"
      sx={{ px: 0.75, py: 0.25, borderRadius: '4px', bgcolor: 'action.hover', color: 'text.primary', fontFamily: 'monospace', fontSize: '0.9em' }}
    >
      {children}
    </Box>
  )
}

function QuickStartGuide() {
  return (
    <>
      <GuideSection title="1. Подключите загрузку чеков">
        <Text>
          Зарегистрируйтесь на <Link href="https://proverkacheka.com" target="_blank" rel="noreferrer">proverkacheka.com</Link>,
          получите персональный ключ и сохраните его в разделе «Профиль» → «Ключ сервиса проверки чеков».
        </Text>
      </GuideSection>
      <GuideSection title="2. Добавьте первый чек">
        <Text>Нажмите «Добавить» → «Добавить чек». Отсканируйте QR-код камерой или вставьте его содержимое вручную. AutoEco создаст чек и отдельную операцию для каждой позиции.</Text>
      </GuideSection>
      <GuideSection title="3. Наведите порядок">
        <Text>Создайте теги для категорий расходов, а повторяющиеся варианты названий магазинов и товаров объедините с помощью правил. Если простой подстроки недостаточно, используйте regex.</Text>
      </GuideSection>
      <GuideSection title="4. Посмотрите результат">
        <Text>«Таблица» показывает все операции, «Чеки» — исходные покупки, а «Аналитика» помогает сравнивать периоды и следить за ценами.</Text>
      </GuideSection>
      <Alert severity="info" sx={{ borderRadius: '8px' }}>Нет QR-кода? Расход или доход всегда можно добавить вручную — ключ сервиса для этого не нужен.</Alert>
    </>
  )
}

function ReceiptsGuide() {
  return (
    <>
      <GuideSection title="Почему AutoEco не получает чек напрямую из ФНС">
        <Text>
          Официальные сведения о кассовом чеке находятся у Федеральной налоговой службы. Прямое интеграционное получение таких данных предоставляется юридическим лицам. AutoEco — частный проект, поэтому не обращается к ФНС напрямую.
        </Text>
      </GuideSection>
      <GuideSection title="Кто участвует в загрузке">
        <Stack spacing={1}>
          {['ФНС хранит официальные сведения о кассовом чеке.', 'Юридическое лицо — сервис «Проверка чеков» — получает сведения из ФНС.', 'AutoEco передаёт сервису данные QR-кода с вашим персональным ключом.', 'Полученный чек сохраняется в вашем аккаунте AutoEco.'].map((step, index) => (
            <Card key={step} variant="outlined" sx={{ p: 1.5, display: 'flex', gap: 1.25, alignItems: 'center', boxShadow: 'none' }}>
              <Chip label={index + 1} size="small" color="primary" sx={{ minWidth: 28 }} />
              <Typography variant="body2" sx={{ lineHeight: 1.55 }}>{step}</Typography>
            </Card>
          ))}
        </Stack>
      </GuideSection>
      <Alert severity="warning" sx={{ borderRadius: '8px' }}>
        «Проверка чеков» — внешний сервис и самостоятельное юридическое лицо. Для работы используется ваш собственный ключ; его условия и ограничения определяются этим сервисом.
      </Alert>
      <GuideSection title="Что находится в QR-коде">
        <Text>QR-код содержит реквизиты, по которым можно найти чек: дату и время, сумму, фискальный накопитель, номер документа и фискальный признак. Названия товаров и другие подробности возвращаются после проверки.</Text>
      </GuideSection>
    </>
  )
}

function StorageGuide() {
  return (
    <>
      <GuideSection title="Из чего состоит учёт">
        <Bullet><strong>Чек</strong> — общая информация о покупке: магазин, дата, итоговая сумма, реквизиты и исходный ответ сервиса, если чек загружен по QR.</Bullet>
        <Bullet><strong>Операции</strong> — позиции внутри чека. Ручная операция может существовать без чека.</Bullet>
        <Bullet><strong>Ваши настройки</strong> — теги, правила переименования, тема интерфейса и другие параметры учёта.</Bullet>
        <Bullet><strong>Ключ «Проверки чеков»</strong> привязан к аккаунту и используется сервером при загрузке по QR. Интерфейс не показывает сохранённое значение ключа.</Bullet>
      </GuideSection>
      <GuideSection title="Связь данных с аккаунтом">
        <Text>Чеки, операции, теги и правила относятся к вашему аккаунту. Вход с другого устройства открывает тот же набор данных после авторизации.</Text>
      </GuideSection>
      <GuideSection title="Исправление и перенос">
        <Text>Операции можно редактировать в интерфейсе. Для переноса или собственной резервной копии используйте экспорт. Подробнее об обработке персональных данных — в <Link component={RouterLink} to="/privacy">политике конфиденциальности</Link>.</Text>
      </GuideSection>
    </>
  )
}

function MathGuide() {
  return (
    <>
      <GuideSection title="Баланс">
        <Text>Баланс вычисляется из операций: <Code>доходы − расходы</Code>. Начальный остаток можно внести как обычную доходную операцию. Карточка баланса показывает результат на конец выбранного периода.</Text>
      </GuideSection>
      <GuideSection title="Сумма позиции">
        <Text>Для товара сумма обычно соответствует <Code>количество × цена</Code>. В чеке итог позиции уже приходит в данных ФНС; небольшие различия возможны из-за скидок и округления кассы.</Text>
      </GuideSection>
      <GuideSection title="Сравнение периодов">
        <Text>Дельта сравнивает выбранный интервал с предыдущим интервалом такой же длины: месяц — с прошлым месяцем, последние три месяца — с тремя месяцами перед ними.</Text>
        <Bullet>Положительная дельта доходов означает, что доходы выросли.</Bullet>
        <Bullet>Отрицательная дельта расходов означает, что траты снизились.</Bullet>
        <Bullet>Для «Всё время» дельта не рассчитывается: предыдущего интервала нет.</Bullet>
      </GuideSection>
      <GuideSection title="График баланса">
        <Text>Линия показывает накопленный итог по дням, а не сумму каждого отдельного дня. Поэтому каждая следующая точка учитывает все более ранние операции.</Text>
      </GuideSection>
    </>
  )
}

const REGEX_ROWS = [
  ['перекресток', 'Находит эту последовательность в любой части названия'],
  ['^ооо', 'Находит «ооо» только в начале'],
  ['магазин$', 'Находит «магазин» только в конце'],
  ['перекр[её]сток', 'Допускает «е» или «ё» в одной позиции'],
  ['кофе|капучино', 'Находит один из двух вариантов'],
  ['\\s+', 'Находит один или несколько пробельных символов'],
  ['.*', 'Находит любое количество любых символов'],
] as const

function RegexGuide() {
  return (
    <>
      <GuideSection title="Сначала попробуйте обычное правило">
        <Text>Если все варианты содержат одну устойчивую подстроку, выключите «Регулярное выражение». Шаблон <Code>перекресток</Code> найдёт эту подстроку без учёта регистра — это проще и безопаснее.</Text>
      </GuideSection>
      <GuideSection title="Что такое regex">
        <Text>Regex — шаблон для поиска текста. Он полезен, когда название приходит в нескольких формах. Сопоставление в AutoEco не зависит от регистра.</Text>
        <Stack spacing={0} divider={<Divider flexItem />} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: '8px', overflow: 'hidden' }}>
          {REGEX_ROWS.map(([pattern, meaning]) => (
            <Box key={pattern} sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '160px 1fr' }, gap: 1, p: 1.25, bgcolor: 'background.paper' }}>
              <Box component="code" sx={{ fontFamily: 'monospace', color: 'primary.main', fontWeight: 700 }}>{pattern}</Box>
              <Typography variant="body2" color="text.secondary">{meaning}</Typography>
            </Box>
          ))}
        </Stack>
      </GuideSection>
      <GuideSection title="Готовые примеры">
        <Bullet><Code>^пят[её]рочка</Code> → «Пятёрочка»: вариант с «е» или «ё» в начале названия.</Bullet>
        <Bullet><Code>^(ооо\s+)?ромашка$</Code> → «Ромашка»: точное название с необязательным «ООО ».</Bullet>
        <Bullet><Code>сыр(ок|ки)</Code> → «Сырок»: находит формы «сырок» и «сырки».</Bullet>
      </GuideSection>
      <GuideSection title="Приоритет правил">
        <Text>Если подходят несколько правил, побеждает правило с большим приоритетом. При одинаковом приоритете применяется более длинный шаблон. Узкие правила ставьте выше общих.</Text>
      </GuideSection>
      <Alert severity="info" sx={{ borderRadius: '8px' }}>
        Символы <Code>.</Code>, <Code>*</Code>, <Code>+</Code>, <Code>?</Code>, <Code>(</Code>, <Code>)</Code>, <Code>[</Code> и <Code>]</Code> имеют специальный смысл. Чтобы искать точку буквально, напишите <Code>\.</Code>. Начинайте с узкого шаблона: слишком общий <Code>.*</Code> совпадёт почти со всем.
      </Alert>
      <GuideSection title="Как применяются изменения">
        <Text>Новое правило сразу применяется к подходящим записям. Кнопка «Применить все алиасы» повторно проверяет существующие чеки и операции. Это переименование необратимо, поэтому сначала проверьте шаблон на нескольких реальных названиях.</Text>
      </GuideSection>
    </>
  )
}

function DataGuide() {
  return (
    <>
      <GuideSection title="Экспорт">
        <Text>AutoEco выгружает операции в Excel: отдельный лист для каждого месяца и колонки «Дата», «Категория», «Магазин», «Описание», «Доход», «Расход». Такой файл удобно хранить как собственную копию или анализировать отдельно.</Text>
      </GuideSection>
      <GuideSection title="Импорт">
        <Text>Поддерживаются файлы XLSX и CSV в ожидаемом формате. До записи показывается предпросмотр: строки с ошибками можно исключить, а отсутствующие теги — создать автоматически.</Text>
      </GuideSection>
      <GuideSection title="Перед большой загрузкой">
        <Bullet>Сначала импортируйте небольшой фрагмент и проверьте даты, суммы и категории.</Bullet>
        <Bullet>Не загружайте один и тот же набор повторно, если не уверены, как обработаются дубликаты.</Bullet>
        <Bullet>Сохраните исходный файл до завершения проверки.</Bullet>
      </GuideSection>
    </>
  )
}

const PAGE_CONTENT: Record<GuideSlug, ReactNode> = {
  'quick-start': <QuickStartGuide />,
  receipts: <ReceiptsGuide />,
  storage: <StorageGuide />,
  math: <MathGuide />,
  regex: <RegexGuide />,
  data: <DataGuide />,
}

export function AboutPage() {
  const theme = useTheme()
  const { topic = 'quick-start' } = useParams<{ topic?: string }>()
  const current = GUIDE_PAGES.find((page) => page.slug === topic)

  if (!current) return <Navigate to="/about/quick-start" replace />

  return (
    <Stack spacing={2.5} sx={{ maxWidth: 1080, mx: 'auto', width: '100%', pb: 2 }}>
      <PageHeader title="Справка AutoEco" subtitle="Короткие инструкции о чеках, расчётах и организации данных" />

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '260px minmax(0, 1fr)' }, gap: 2.5, alignItems: 'start' }}>
        <Card component="nav" aria-label="Разделы справки" sx={{ p: 1, position: { md: 'sticky' }, top: { md: 0 } }}>
          <Stack spacing={0.5}>
            {GUIDE_PAGES.map(({ slug, title, description, icon: Icon }) => {
              const active = current.slug === slug
              return (
                <Box
                  key={slug}
                  component={RouterLink}
                  to={`/about/${slug}`}
                  aria-current={active ? 'page' : undefined}
                  sx={{ display: 'flex', gap: 1.25, alignItems: 'center', p: 1.25, borderRadius: '7px', textDecoration: 'none', color: active ? softFg(theme) : 'text.primary', bgcolor: active ? softBg(theme) : 'transparent', '&:hover': { bgcolor: active ? softBg(theme) : 'action.hover' } }}
                >
                  <Icon sx={{ fontSize: 20, flexShrink: 0 }} />
                  <Box sx={{ minWidth: 0 }}>
                    <Typography sx={{ fontSize: 13.5, fontWeight: 700 }}>{title}</Typography>
                    <Typography color="text.secondary" sx={{ fontSize: 11.5, lineHeight: 1.35 }}>{description}</Typography>
                  </Box>
                </Box>
              )
            })}
            <Divider sx={{ my: 0.5 }} />
            <Box component={RouterLink} to="/privacy" sx={{ display: 'flex', gap: 1.25, alignItems: 'center', p: 1.25, borderRadius: '7px', textDecoration: 'none', color: 'text.primary', '&:hover': { bgcolor: 'action.hover' } }}>
              <SecurityOutlinedIcon sx={{ fontSize: 20 }} />
              <Typography sx={{ fontSize: 13.5, fontWeight: 700 }}>Конфиденциальность</Typography>
            </Box>
          </Stack>
        </Card>

        <Card component="article" sx={{ p: { xs: 2, sm: 3.5 } }}>
          <Stack spacing={3}>
            <Box>
              <Typography variant="h4" sx={{ fontSize: { xs: 24, sm: 30 }, mb: 0.75 }}>{current.title}</Typography>
              <Typography color="text.secondary">{current.description}</Typography>
            </Box>
            <Divider />
            {PAGE_CONTENT[current.slug]}
            <Divider />
            <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
              {(() => {
                const next = GUIDE_PAGES[GUIDE_PAGES.findIndex((page) => page.slug === current.slug) + 1]
                return next ? (
                  <Link component={RouterLink} to={`/about/${next.slug}`} underline="hover" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, fontWeight: 700 }}>
                    Далее: {next.title} <ArrowForwardOutlinedIcon sx={{ fontSize: 18 }} />
                  </Link>
                ) : null
              })()}
            </Box>
          </Stack>
        </Card>
      </Box>
    </Stack>
  )
}
