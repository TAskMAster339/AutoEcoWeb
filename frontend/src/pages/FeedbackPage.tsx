import { useState } from 'react'
import { Alert, Button, Card, MenuItem, Stack, TextField, Typography } from '@mui/material'
import { EmptyState, ErrorState, LoadingState } from '../components/common/States'
import { messageFromError } from '../api/client'
import { FEEDBACK_TEMPLATES } from '../api/feedback'
import { useAnswerFeedback, useCloseFeedback, useCreateFeedback, useFeedback, useMyFeedback } from '../hooks/useFeedback'

export function FeedbackPage() {
    const { data, isPending, isError, error } = useMyFeedback()
    const create = useCreateFeedback()
    const [subject, setSubject] = useState('')
    const [message, setMessage] = useState('')
    const submit = () => {
        if (subject.trim().length < 3 || message.trim().length < 10) return
        create.mutate({ subject: subject.trim(), message: message.trim() }, { onSuccess: () => { setSubject(''); setMessage('') } })
    }
    return (
        <Stack spacing={2} sx={{ maxWidth: 760, mx: 'auto', width: '100%' }}>
            <Card sx={{ p: { xs: 2, sm: 3 } }}><Stack spacing={2}>
                <TextField label="Тема обращения" value={subject} onChange={(e) => setSubject(e.target.value)} inputProps={{ maxLength: 200 }} fullWidth />
                <TextField label="Сообщение" value={message} onChange={(e) => setMessage(e.target.value)} multiline minRows={5} inputProps={{ maxLength: 10000 }} fullWidth />
                {create.isError && <Alert severity="error">{messageFromError(create.error)}</Alert>}
                {create.isSuccess && <Alert severity="success">Обращение получено. Мы отправили подтверждение на вашу почту.</Alert>}
                <Button variant="contained" onClick={submit} disabled={create.isPending || subject.trim().length < 3 || message.trim().length < 10}>{create.isPending ? 'Отправляем…' : 'Отправить обращение'}</Button>
            </Stack></Card>
            <Typography variant="h6">Мои обращения</Typography>
            {isPending ? <LoadingState label="Загружаем обращения…" /> : isError ? <ErrorState message={messageFromError(error)} /> : !data?.length ? <EmptyState title="Обращений пока нет" subtitle="Если нужна помощь, создайте первое обращение выше." /> : <Stack spacing={1.5}>{data.map((item) => <Card key={item.id} sx={{ p: { xs: 1.5, sm: 2 } }}><Typography fontWeight={700} sx={{ overflowWrap: 'anywhere' }}>{item.subject}</Typography><Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'pre-wrap', mt: 1 }}>{item.message}</Typography><Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>Статус: {item.status === 'open' ? 'Ожидает ответа' : item.status === 'answered' ? 'Есть ответ' : 'Закрыто'}</Typography>{item.admin_reply && <Alert severity="info" sx={{ mt: 1.5, whiteSpace: 'pre-wrap' }}>{item.admin_reply}</Alert>}</Card>)}</Stack>}
        </Stack>
    )
}

export function FeedbackAdminPanel() {
    const [statusFilter, setStatusFilter] = useState('open')
    const [page, setPage] = useState(0)
    const { data, isPending, isError, error, isFetching } = useFeedback(statusFilter, page)
    const answer = useAnswerFeedback(); const close = useCloseFeedback()
    const [drafts, setDrafts] = useState<Record<string, string>>({})
    if (isPending) return <LoadingState label="Загружаем обращения…" />
    if (isError) return <ErrorState message={messageFromError(error)} />
    return <Stack spacing={1.5}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} justifyContent="space-between" alignItems={{ sm: 'center' }}>
            <Typography variant="h6">Обращения пользователей</Typography>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} justifyContent="flex-end" alignItems={{ sm: 'center' }} sx={{ width: { xs: '100%', sm: 'auto' } }}>
                <TextField select size="small" label="Показывать обращения" value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); setPage(0) }} sx={{ width: { xs: '100%', sm: 220 } }}>
                    <MenuItem value="open">Нерешённые</MenuItem>
                    <MenuItem value="answered">Отвеченные</MenuItem>
                    <MenuItem value="closed">Закрытые</MenuItem>
                    <MenuItem value="all">Все обращения</MenuItem>
                </TextField>
                {isFetching && <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>Обновляем…</Typography>}
            </Stack>
        </Stack>
        {!(data?.items?.length ?? 0) && <EmptyState title="Обращений нет" subtitle={statusFilter === 'open' ? 'Для выбранного статуса обращений нет.' : 'Новые заявки появятся здесь.'} />}
        {(data?.items ?? []).map((item) => { const text = drafts[item.id] ?? ''; return <Card key={item.id} sx={{ p: { xs: 1.5, sm: 2 } }}><Stack spacing={1.25}><Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" gap={0.5}><Typography fontWeight={700} sx={{ overflowWrap: 'anywhere' }}>{item.subject}</Typography><Typography variant="caption" color={item.status === 'open' ? 'warning.main' : 'success.main'}>{item.status === 'open' ? 'Нерешено' : item.status === 'answered' ? 'Отвечено' : 'Закрыто'}</Typography></Stack><Typography variant="caption" color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>{item.email}</Typography><Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{item.message}</Typography>{item.admin_reply && <Alert severity="success" sx={{ whiteSpace: 'pre-wrap' }}>Ответ: {item.admin_reply}</Alert>}{item.status === 'open' && <><Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', rowGap: 1 }}>{FEEDBACK_TEMPLATES.map((template) => <Button key={template.label} size="small" variant="outlined" onClick={() => setDrafts((v) => ({ ...v, [item.id]: template.text }))}>{template.label}</Button>)}</Stack><TextField label="Ответ пользователю" value={text} onChange={(e) => setDrafts((v) => ({ ...v, [item.id]: e.target.value }))} multiline minRows={3} fullWidth /><Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}><Button fullWidth variant="contained" disabled={!text.trim() || answer.isPending} onClick={() => answer.mutate({ id: item.id, data: { reply: text } })}>Ответить и закрыть</Button><Button fullWidth variant="outlined" onClick={() => close.mutate(item.id)} disabled={close.isPending}>Закрыть без ответа</Button></Stack></>}</Stack></Card> })}
        {data && data.total > data.limit && <Stack direction="row" justifyContent="center" alignItems="center" spacing={2} sx={{ pt: 1 }}><Button variant="outlined" disabled={page === 0 || isFetching} onClick={() => setPage((value) => value - 1)}>Назад</Button><Typography variant="body2" color="text.secondary">Страница {page + 1} из {Math.ceil(data.total / data.limit)}</Typography><Button variant="outlined" disabled={(page + 1) * data.limit >= data.total || isFetching} onClick={() => setPage((value) => value + 1)}>Далее</Button></Stack>}
    </Stack>
}
