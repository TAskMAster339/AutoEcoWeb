import { useEffect } from 'react'
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
import WebOutlinedIcon from '@mui/icons-material/WebOutlined'
import InsightsOutlinedIcon from '@mui/icons-material/InsightsOutlined'
import SellOutlinedIcon from '@mui/icons-material/SellOutlined'
import VolunteerActivismOutlinedIcon from '@mui/icons-material/VolunteerActivismOutlined'
import ArrowBackOutlinedIcon from '@mui/icons-material/ArrowBackOutlined'
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
    { slug: 'tags', title: 'Теги и категории', description: 'Как группировать операции и читать их в аналитике', icon: SellOutlinedIcon },
    { slug: 'data', title: 'Импорт и экспорт', description: 'Перенос данных и резервная копия', icon: ImportExportOutlinedIcon },
    { slug: 'pages', title: 'Страницы сервиса', description: 'Что находится в каждом разделе и для чего он нужен', icon: WebOutlinedIcon },
    { slug: 'interpretation', title: 'Как читать аналитику', description: 'Смысл показателей, периодов и графиков', icon: InsightsOutlinedIcon },
    { slug: 'commercial', title: 'Коммерция и финансирование', description: 'Почему сервис не зарабатывает на пользователях', icon: VolunteerActivismOutlinedIcon },
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

function WikiLink({ to, children }: { to: GuideSlug; children: ReactNode }) {
    return <Link component={RouterLink} to={`/about/${to}`} color="primary" underline="hover" fontWeight={700}>{children}</Link>
}

function QuickStartGuide() {
    return (
        <>
            <GuideSection title="1. Подключите загрузку чеков">
                <Text>
                    Зарегистрируйтесь на <Link href="https://proverkacheka.com" target="_blank" rel="noreferrer" color="primary" underline="hover" fontWeight={700}>proverkacheka.com</Link>,
                    получите у них персональный ключ в вкладке «Профиль», пункт «Токен доступа к API». И сохраните его на нашем сайте в разделе «Профиль» → «Ключ сервиса проверки чеков».
                </Text>
            </GuideSection>
            <GuideSection title="2. Добавьте первый чек">
                <Text>Нажмите «Добавить» → «Добавить чек». Отсканируйте QR-код камерой или вставьте его содержимое вручную. AutoEco создаст чек и отдельную операцию для каждой позиции.</Text>
            </GuideSection>
            <GuideSection title="3. Наведите порядок">
                <Text>Создайте <WikiLink to="tags">теги</WikiLink> для категорий расходов, а повторяющиеся варианты названий магазинов и товаров объедините с помощью <WikiLink to="regex">правил</WikiLink>. Если простой подстроки недостаточно, используйте regex.</Text>
            </GuideSection>
            <GuideSection title="4. Посмотрите результат">
                <Text>«Таблица» показывает все операции, «Чеки» — исходные покупки, а <WikiLink to="interpretation">аналитика</WikiLink> помогает сравнивать периоды и следить за ценами.</Text>
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
                <Text>Операции можно редактировать в интерфейсе. Для переноса или собственной резервной копии используйте <WikiLink to="data">импорт и экспорт</WikiLink>. Подробнее об обработке персональных данных — в <Link component={RouterLink} to="/privacy" color="primary" underline="hover" fontWeight={700}>политике конфиденциальности</Link>.</Text>
            </GuideSection>
        </>
    )
}

function MathGuide() {
    return (
        <>
            <GuideSection title="Баланс">
                <Text>Баланс на конец периода рассчитывается как <Code>начальный остаток + доходы − расходы</Code>. Начальным остатком служит накопленный итог до начала выбранного интервала; для периода «Всё время» он равен нулю. Поэтому карточка показывает состояние денег на последнюю дату периода, а не только разницу между поступлениями и тратами внутри него.</Text>
            </GuideSection>
            <GuideSection title="Сумма позиции">
                <Text>Для вручную добавляемой позиции сумма рассчитывается как <Code>количество × цена</Code> и округляется до копеек. В чеке итог позиции приходит из фискальных данных; небольшое отличие от умножения возможно из-за скидок, акций и округления кассы. В сводках доходом считаются операции возврата и дохода, расходом — покупки и другие расходные операции.</Text>
            </GuideSection>
            <GuideSection title="Средняя, медиана, дисперсия и стандартное отклонение">
                <Text>Для цен <Code>x₁, x₂, …, xₙ</Code> средняя цена рассчитывается по формуле <Code>x̄ = (x₁ + x₂ + … + xₙ) / n</Code>. Она показывает общий уровень цен, но чувствительна к редким дорогим или дешёвым покупкам: одна необычная цена может заметно сдвинуть результат.</Text>
                <Text>Медиана — центральное значение отсортированного набора цен; половина покупок стоит не дороже неё, половина — не дешевле. Она лучше отвечает на вопрос «какая цена обычно встречается», когда в данных есть акции, ошибки или единичные выбросы.</Text>
                <Text>Дисперсия измеряет средний квадрат отклонения от средней: <Code>D = Σ(xᵢ − x̄)² / n</Code>. Она выражается в квадратных рублях, поэтому в интерфейсе показывается более наглядное стандартное отклонение: <Code>σ = √D</Code>. Чем больше σ, тем сильнее цены отличаются друг от друга; чем ближе σ к нулю, тем стабильнее цены.</Text>
                <Alert severity="info" sx={{ borderRadius: '8px' }}>Средняя показывает общий уровень, медиана защищает от выбросов, а стандартное отклонение характеризует устойчивость цен. Полезно смотреть на эти показатели вместе.</Alert>
            </GuideSection>
            <GuideSection title="Сравнение периодов">
                <Text>Дельта — это разность показателя выбранного интервала и предыдущего интервала той же длины: месяц сравнивается с прошлым месяцем, три месяца — с предыдущими тремя. Такой способ сопоставляет равные отрезки времени и не создаёт ложный эффект роста только потому, что в одном периоде больше дней. Практические советы по выбору периода собраны в <WikiLink to="interpretation">разделе об интерпретации аналитики</WikiLink>.</Text>
                <Bullet>Положительная дельта доходов означает, что доходы выросли.</Bullet>
                <Bullet>Отрицательная дельта расходов означает, что траты снизились.</Bullet>
                <Bullet>Для «Всё время» дельта не рассчитывается: предыдущего интервала нет.</Bullet>
            </GuideSection>
            <GuideSection title="Расходы по дням и линия тренда">
                <Text>Линейный график показывает сумму расходов каждого дня выбранного периода. Он выбран для временного ряда: соседние точки естественно читаются как изменение во времени, а пики и спокойные дни заметны сразу. В подсказке также видны доходы, число операций и баланс конкретного дня.</Text>
                <Text>Пунктир — линейный тренд, рассчитанный методом наименьших квадратов по дневным расходам. Он не предсказывает будущее и не заменяет реальные значения: его задача — сгладить случайные всплески и помочь увидеть общее направление расходов. Ограничения статистических выводов описаны в <WikiLink to="interpretation">руководстве по интерпретации аналитики</WikiLink>.</Text>
            </GuideSection>
            <GuideSection title="Распределение по магазинам, источникам дохода и категориям">
                <Text>Три кольцевые диаграммы показывают, какую долю общей суммы составляет каждый магазин, источник дохода или тег. Кольцо удобно, когда важнее структура целого и доли, а в центре остаётся видимой общая сумма. Точные значения и проценты доступны в легенде и при наведении; по элементу можно перейти к соответствующим операциям.</Text>
                <Text>Доли меньше 1 % объединяются в «Другое». Это сохраняет общую сумму, но не перегружает диаграмму множеством почти неразличимых секторов. Цвета диаграмм намеренно не используют фирменный фиолетовый, чтобы данные не смешивались с управляющими элементами интерфейса.</Text>
            </GuideSection>
            <GuideSection title="Траты по дням недели">
                <Text>Столбцы суммируют расходы по понедельникам, вторникам и остальным дням недели за выбранный период. Столбчатая форма выбрана потому, что дни недели — отдельные категории, а не непрерывная шкала: высоту столбцов проще и честнее сравнивать между собой. Показываются все семь дней, в том числе с нулевыми тратами, чтобы отсутствие покупок не выглядело как пропуск данных.</Text>
            </GuideSection>
            <GuideSection title="График цен товара">
                <Text>После ввода названия товара график строит точки покупок по датам. Цвет точки обозначает магазин, поэтому можно сопоставить цену во времени и место покупки. Здесь шкала Y строится вокруг фактического диапазона цен, а не от нуля: для близких цен это делает различия заметными; график не следует воспринимать как сравнение абсолютных объёмов расходов.</Text>
                <Text>Карточки рядом показывают среднюю цену, медиану и стандартное отклонение. Пунктир на графике — медиана: она даёт устойчивый ориентир для сравнения очередной покупки.</Text>
            </GuideSection>
        </>
    )
}

function PagesGuide() {
    return (
        <>
            <GuideSection title="Основные разделы">
                <Bullet><Link component={RouterLink} to="/transactions" color="primary" underline="hover" fontWeight={700}>Таблица</Link> — полный журнал операций. Здесь можно искать, фильтровать по периоду, магазину и тегам, сортировать записи, открывать и редактировать отдельные операции.</Bullet>
                <Bullet><Link component={RouterLink} to="/analytics" color="primary" underline="hover" fontWeight={700}>Аналитика</Link> — сводные показатели и графики по выбранному периоду: расходы, доходы, баланс, распределение по категориям и магазинам, дни покупок и цены товаров.</Bullet>
                <Bullet><Link component={RouterLink} to="/receipt" color="primary" underline="hover" fontWeight={700}>Чеки</Link> — исходные покупки, загруженные по QR-коду. Откройте чек, чтобы посмотреть реквизиты и позиции; при необходимости добавляйте чеки камерой или вручную через меню «Добавить».</Bullet>
                <Bullet><strong>Карточка чека</strong> — подробная страница конкретного чека с его реквизитами, продавцом и всеми позициями. Она нужна, чтобы сверить исходные данные и перейти к связанным операциям.</Bullet>
                <Bullet><Link component={RouterLink} to="/tags" color="primary" underline="hover" fontWeight={700}>Теги</Link> — категории операций. Здесь создают, переименовывают, настраивают цвет и удаляют теги, затем используют их для фильтрации и аналитики.</Bullet>
                <Bullet><Link component={RouterLink} to="/sellers" color="primary" underline="hover" fontWeight={700}>Магазины</Link> — список продавцов из операций и чеков. Карточка показывает число связанных записей и открывает их в таблице; название магазина можно исправить.</Bullet>
                <Bullet><Link component={RouterLink} to="/rules" color="primary" underline="hover" fontWeight={700}>Правила</Link> — нормализация названий товаров и магазинов: обычное текстовое совпадение или регулярное выражение объединяет разные варианты в понятное имя.</Bullet>
            </GuideSection>
            <GuideSection title="Настройка и помощь">
                <Bullet><Link component={RouterLink} to="/data" color="primary" underline="hover" fontWeight={700}>Данные</Link> — экспорт всех операций в Excel и импорт XLSX или CSV с предпросмотром строк перед записью.</Bullet>
                <Bullet><Link component={RouterLink} to="/profile" color="primary" underline="hover" fontWeight={700}>Профиль</Link> — параметры аккаунта и ключ сервиса «Проверка чеков», который нужен только для загрузки чеков по QR-коду.</Bullet>
                <Bullet><Link component={RouterLink} to="/about/quick-start" color="primary" underline="hover" fontWeight={700}>Справка</Link> — объяснение устройства сервиса, расчётов, правил и переноса данных.</Bullet>
                <Bullet><Link component={RouterLink} to="/feedback" color="primary" underline="hover" fontWeight={700}>Обратная связь</Link> — канал, чтобы задать вопрос, сообщить об ошибке или предложить улучшение.</Bullet>
                <Bullet><Link component={RouterLink} to="/privacy" color="primary" underline="hover" fontWeight={700}>Политика конфиденциальности</Link> — сведения о том, какие данные обрабатываются, для чего и как обратиться по вопросам персональных данных.</Bullet>
            </GuideSection>
            <GuideSection title="Доступ к аккаунту">
                <Bullet><Link component={RouterLink} to="/login" color="primary" underline="hover" fontWeight={700}>Вход и регистрация</Link> — начальная страница сервиса: здесь создают аккаунт, принимают политику конфиденциальности и входят в существующий.</Bullet>
                <Bullet><Link component={RouterLink} to="/verify-email" color="primary" underline="hover" fontWeight={700}>Подтверждение email</Link> — ввод шестизначного кода после регистрации, чтобы подтвердить адрес электронной почты.</Bullet>
                <Bullet><Link component={RouterLink} to="/recover" color="primary" underline="hover" fontWeight={700}>Восстановление доступа</Link> — отдельный сценарий, в котором можно запросить код на почту и задать новый пароль.</Bullet>
                <Bullet><strong>Страница «Не найдено»</strong> — появляется при переходе по несуществующему адресу и помогает вернуться в сервис.</Bullet>
            </GuideSection>
        </>
    )
}

function InterpretationGuide() {
    return (
        <>
            <GuideSection title="Сначала проверьте, что именно сравниваете">
                <Text>Все карточки и графики в «Аналитике» относятся к выбранному периоду. Перед выводами убедитесь, что период соответствует вопросу: неделя удобна для недавних привычек, месяц — для регулярных трат, несколько месяцев — для устойчивого направления. «Всё время» полезно как общий итог, но плохо подходит для сравнения с предыдущим периодом: у него нет равного предшествующего интервала.</Text>
                <Text>Меняйте период до поиска товара: график цен использует тот же выбранный диапазон дат. При сравнении двух интервалов выбирайте равные по длине периоды — например, текущий месяц и предыдущий, а не 10 дней против полного месяца.</Text>
            </GuideSection>
            <GuideSection title="Как читать график цен">
                <Text>Каждая точка — цена найденного товара в конкретный день, а цвет показывает магазин. Пунктирная линия — медиана: точки выше неё дороже обычного уровня, ниже — дешевле. График помогает заметить изменения во времени, но не доказывает их причину: на цену могут влиять магазин, акция, объём упаковки и состав товара. Формулы и разницу между показателями смотрите в <WikiLink to="math">разделе «Немного математики»</WikiLink>.</Text>
                <Text>Ось цен намеренно не всегда начинается с нуля. Это позволяет увидеть небольшую разницу между близкими ценами, но визуально увеличивает её. Поэтому точную величину оценивайте по подсказке и значениям, а не только по высоте точек.</Text>
            </GuideSection>
            <GuideSection title="Сопоставляйте одинаковые товары">
                <Text>Поиск объединяет все позиции, которые подходят под введённое название или шаблон. Это удобно для обзора, но смешивание разного объёма делает вывод о цене неточным. Например, запрос <Code>*биойогурт*</Code> может найти упаковки 100 г, 200 г и 500 г: их цены нельзя напрямую сравнивать как цену одного и того же товара.</Text>
                <Text>Для более честной аналитики уточняйте запрос: <Code>*биойогурт*200г*</Code> — пример поиска только упаковки 200 г. Используйте написание, которое реально встречается в позициях чека. Если производитель, жирность или объём существенно влияют на цену, добавляйте и эти признаки; при необходимости включите режим Regex для более точного шаблона. Примеры шаблонов есть в разделе <WikiLink to="regex">«Правила и regex»</WikiLink>.</Text>
            </GuideSection>
            <GuideSection title="Как интерпретировать остальные графики">
                <Bullet><strong>Расходы по дням:</strong> всплеск означает большую сумму трат в конкретный день, а не обязательно больше покупок. Сверьте подсказку с числом операций и доходами этого дня.</Bullet>
                <Bullet><strong>Линия тренда:</strong> показывает сглаженное направление, а не прогноз. Один высокий чек не означает, что тренд действительно изменился; оценивайте несколько периодов.</Bullet>
                <Bullet><strong>Кольцевые диаграммы:</strong> показывают долю от общей суммы. Большой сектор означает значительную часть трат или доходов, но не показывает частоту покупок — для этого смотрите счётчики и таблицу.</Bullet>
                <Bullet><strong>Дни недели:</strong> сравнивайте высоту столбцов, чтобы заметить повторяющийся день трат. Один период может быть случайным, поэтому подтверждайте закономерность несколькими неделями.</Bullet>
            </GuideSection>
            <GuideSection title="Статистика помогает наблюдать, но не объясняет причины">
                <Alert severity="warning" sx={{ borderRadius: '8px' }}>ВАЖНО: статистику нельзя интерпретировать как причинно-следственную связь. График показывает, что показатели менялись одновременно или вслед за другим событием, но сам по себе не доказывает, почему это произошло.</Alert>
                <Text>Например, высокий расход в выходной может совпасть с поездкой, праздником или крупной покупкой, но причина не содержится в линии или столбце. Проверяйте гипотезы по исходным операциям, чекам и своему контексту, а не выводите объяснение только из формы графика.</Text>
                <Text>Цель аналитики — замечать изменения, строить и корректировать личную финансовую стратегию, искать скрытые закономерности и возможные корреляции, которые трудно увидеть в обычном списке операций. Корреляция — повод задать вопрос и проверить данные, а не готовый ответ о причине.</Text>
            </GuideSection>
        </>
    )
}

function TagsGuide() {
    return (
        <>
            <GuideSection title="Зачем нужны теги">
                <Text>Тег — это пользовательская категория операции: например, «Продукты», «Транспорт», «Кафе» или «Здоровье». Он помогает объединить разные товары и магазины по смыслу, отфильтровать их в таблице и увидеть структуру расходов на кольцевой диаграмме «По категориям».</Text>
            </GuideSection>
            <GuideSection title="Как пользоваться">
                <Bullet>Создайте тег на странице <Link component={RouterLink} to="/tags" color="primary" underline="hover" fontWeight={700}>«Теги»</Link> и задайте понятное название.</Bullet>
                <Bullet>Назначайте его операциям, чтобы одни и те же траты попадали в общую категорию.</Bullet>
                <Bullet>Используйте фильтр тега в таблице, чтобы посмотреть только нужную часть истории. О настройке сопоставления названий читайте в разделе <WikiLink to="regex">«Правила и regex»</WikiLink>.</Bullet>
                <Bullet>Смотрите аналитику по категориям, чтобы сравнить доли трат и найти направления для финансового плана; правила осмысленного чтения графиков собраны в <WikiLink to="interpretation">руководстве по интерпретации</WikiLink>.</Bullet>
            </GuideSection>
            <GuideSection title="Цвет и иконка">
                <Text>Цвет тега — визуальная метка категории. Его видно на карточке тега, в фильтрах и аналитике; один устойчивый цвет помогает быстрее узнавать категорию. При создании и редактировании можно выбрать один из готовых цветов или указать свой в формате HEX.</Text>
                <Text>В текущей версии теги не хранят и не позволяют выбирать отдельную иконку: их идентификаторами в интерфейсе служат название и цвет. Если выбор иконок появится в сервисе, он потребует отдельной поддержки в контракте данных и редакторе тегов.</Text>
            </GuideSection>
        </>
    )
}

function CommercialGuide() {
    return (
        <>
            <GuideSection title="Некоммерческий проект">
                <Text>AutoEco — некоммерческий личный проект. Он не продаёт подписки, не показывает рекламу, не берёт комиссию за операции и не получает доход от пользовательских данных или действий в сервисе.</Text>
            </GuideSection>
            <GuideSection title="Финансирование">
                <Text>Работа сервиса полностью оплачивается создателем: инфраструктура, домен и разработка содержатся за его счёт. Проект не претендует на получение денег; единственный экономический эффект — возможная экономия самих пользователей благодаря более понятному учёту расходов и сравнению цен.</Text>
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
    tags: <TagsGuide />,
    data: <DataGuide />,
    pages: <PagesGuide />,
    interpretation: <InterpretationGuide />,
    commercial: <CommercialGuide />,
}

export function AboutPage() {
    const theme = useTheme()
    const { topic = 'quick-start' } = useParams<{ topic?: string }>()
    const current = GUIDE_PAGES.find((page) => page.slug === topic)

    useEffect(() => {
        document.querySelector('main')?.scrollTo({ top: 0, behavior: 'smooth' })
    }, [topic])

    if (!current) return <Navigate to="/about/quick-start" replace />

    return (
        <Stack spacing={2.5} sx={{ maxWidth: 1080, mx: 'auto', width: '100%', pb: 2 }}>
            <PageHeader title="Справка AutoEco" subtitle="Короткие инструкции о чеках, расчётах и организации данных" />

            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1fr) 260px' }, gap: { xs: 1.5, md: 2.5 }, alignItems: 'start' }}>
                <Card component="article" sx={{ order: { xs: 1, md: 1 }, p: { xs: 2, sm: 3.5 } }}>
                    <Stack spacing={{ xs: 2.25, sm: 3 }}>
                        <Box>
                            <Typography variant="h4" sx={{ fontSize: { xs: 24, sm: 30 }, mb: 0.75 }}>{current.title}</Typography>
                            <Typography color="text.secondary">{current.description}</Typography>
                        </Box>
                        <Divider />
                        {PAGE_CONTENT[current.slug]}
                        <Divider />
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, flexWrap: 'wrap' }}>
                            {(() => {
                                const currentIndex = GUIDE_PAGES.findIndex((page) => page.slug === current.slug)
                                const previous = GUIDE_PAGES[currentIndex - 1]
                                const next = GUIDE_PAGES[currentIndex + 1]
                                return <>
                                    {previous ? (
                                        <Link component={RouterLink} to={`/about/${previous.slug}`} color="primary" underline="hover" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, fontWeight: 700 }}>
                                            <ArrowBackOutlinedIcon sx={{ fontSize: 18 }} /> Назад: {previous.title}
                                        </Link>
                                    ) : <Box />}
                                    {next ? (
                                        <Link component={RouterLink} to={`/about/${next.slug}`} color="primary" underline="hover" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, fontWeight: 700 }}>
                                            Далее: {next.title} <ArrowForwardOutlinedIcon sx={{ fontSize: 18 }} />
                                        </Link>
                                    ) : null}
                                </>
                            })()}
                        </Box>
                    </Stack>
                </Card>

                <Card component="nav" aria-label="Разделы справки" sx={{ order: { xs: 2, md: 2 }, p: 1, position: { md: 'sticky' }, top: { md: 0 } }}>
                    <Stack spacing={0.5} sx={{ display: { xs: 'grid', md: 'flex' }, gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))' }, gap: { xs: 0.5, md: 0 } }}>
                        {GUIDE_PAGES.map(({ slug, title, description, icon: Icon }) => {
                            const active = current.slug === slug
                            return (
                                <Box
                                    key={slug}
                                    component={RouterLink}
                                    to={`/about/${slug}`}
                                    aria-current={active ? 'page' : undefined}
                                    sx={{ display: 'flex', gap: 1.25, alignItems: 'center', minWidth: 0, p: { xs: 1, md: 1.25 }, borderRadius: '7px', textDecoration: 'none', color: active ? softFg(theme) : 'text.primary', bgcolor: active ? softBg(theme) : 'transparent', '&:hover': { bgcolor: active ? softBg(theme) : 'action.hover' } }}
                                >
                                    <Icon sx={{ fontSize: 20, flexShrink: 0 }} />
                                    <Box sx={{ minWidth: 0 }}>
                                        <Typography sx={{ fontSize: 13.5, fontWeight: 700 }}>{title}</Typography>
                                        <Typography color="text.secondary" sx={{ display: { xs: 'none', md: 'block' }, fontSize: 11.5, lineHeight: 1.35 }}>{description}</Typography>
                                    </Box>
                                </Box>
                            )
                        })}
                        <Divider sx={{ gridColumn: { xs: '1 / -1', md: 'auto' }, my: 0.5 }} />
                        <Box component={RouterLink} to="/privacy" sx={{ display: 'flex', gap: 1.25, alignItems: 'center', minWidth: 0, p: { xs: 1, md: 1.25 }, borderRadius: '7px', textDecoration: 'none', color: 'text.primary', '&:hover': { bgcolor: 'action.hover' } }}>
                            <SecurityOutlinedIcon sx={{ fontSize: 20 }} />
                            <Typography sx={{ fontSize: 13.5, fontWeight: 700 }}>Конфиденциальность</Typography>
                        </Box>
                    </Stack>
                </Card>
            </Box>
        </Stack>
    )
}
