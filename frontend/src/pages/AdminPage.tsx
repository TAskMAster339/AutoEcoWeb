import { useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Card,
  Chip,
  CircularProgress,
  IconButton,
  InputAdornment,
  MenuItem,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import SearchIcon from '@mui/icons-material/Search'
import { messageFromError } from '../api/client'
import type { AdminUser, UserRole, UserStatus } from '../api/types'
import { ConfirmDialog } from '../components/common/ConfirmDialog'
import { EmptyState, ErrorState, LoadingState } from '../components/common/States'
import { useAdminUsers, useDeleteUser, useUpdateUser } from '../hooks/useAdminUsers'
import { formatLongDate } from '../lib/format'
import { useAuthStore } from '../store/authStore'
import { colors } from '../theme'
import { FeedbackAdminPanel } from './FeedbackPage'

const STATUS_COLORS: Record<UserStatus, string> = {
  active: colors.green,
  pending: colors.amber,
  verified: colors.primary,
  blocked: colors.red,
}

const ROLE_LABEL: Record<UserRole, string> = { admin: 'Админ', user: 'Пользователь' }
const STATUS_LABEL: Record<UserStatus, string> = {
  active: 'Активен',
  pending: 'Ожидает',
  verified: 'Подтверждён',
  blocked: 'Заблокирован',
}

/** Debounce for the search field. */
function useDebounced<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])
  return debounced
}

interface RowSelectsProps {
  user: AdminUser
  disabled: boolean
  onRoleChange: (role: UserRole) => void
  onStatusChange: (status: UserStatus) => void
}

/** Селекты роли и статуса в строке — любой статус/роль из списка. */
function RowSelects({ user, disabled, onRoleChange, onStatusChange }: RowSelectsProps) {
  return (
    <Stack direction={{ xs: 'row', sm: 'row' }} spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
      <TextField
        select
        size="small"
        label="Роль"
        value={user.role}
        disabled={disabled}
        onChange={(e) => onRoleChange(e.target.value as UserRole)}
        sx={{ minWidth: 132 }}
      >
        {(Object.keys(ROLE_LABEL) as UserRole[]).map((value) => (
          <MenuItem key={value} value={value}>
            {ROLE_LABEL[value]}
          </MenuItem>
        ))}
      </TextField>
      <TextField
        select
        size="small"
        label="Статус"
        value={user.status}
        disabled={disabled}
        onChange={(e) => onStatusChange(e.target.value as UserStatus)}
        sx={{
          minWidth: 150,
          '& .MuiInputBase-input': { color: STATUS_COLORS[user.status], fontWeight: 600 },
        }}
      >
        {(Object.keys(STATUS_LABEL) as UserStatus[]).map((value) => (
          <MenuItem key={value} value={value}>
            {STATUS_LABEL[value]}
          </MenuItem>
        ))}
      </TextField>
    </Stack>
  )
}

interface AdminUserRowProps {
  user: AdminUser
  isMe: boolean
  disabled: boolean
  onRoleChange: (role: UserRole) => void
  onStatusChange: (status: UserStatus) => void
  onDelete: () => void
}

/** Mobile card: email, role/status selects, registration date, delete. */
function AdminUserCard({ user, isMe, disabled, onRoleChange, onStatusChange, onDelete }: AdminUserRowProps) {
  return (
    <Card sx={{ p: 1.5, display: 'flex', alignItems: 'center', gap: 1.5 }}>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="body2" noWrap sx={{ fontWeight: 600 }}>
          {user.email}
        </Typography>
        <RowSelects user={user} disabled={disabled || isMe} onRoleChange={onRoleChange} onStatusChange={onStatusChange} />
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
          {formatLongDate(user.created_at)}
        </Typography>
      </Box>
      {isMe ? (
        <Chip size="small" label="Это вы" sx={{ height: 20, fontSize: 11 }} />
      ) : (
        <Tooltip title="Удалить">
          <span>
            <IconButton size="small" disabled={disabled} onClick={onDelete} sx={{ color: colors.red }}>
              <DeleteOutlineIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
      )}
    </Card>
  )
}

/** /admin — user management (admin only). Real API: GET/PATCH/DELETE /api/v1/admin/users. */
export function AdminPage() {
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('md'))
  const me = useAuthStore((s) => s.user)

  const [q, setQ] = useState('')
  const [role, setRole] = useState<UserRole | ''>('')
  const [status, setStatus] = useState<UserStatus | ''>('')
  const [deleteTarget, setDeleteTarget] = useState<AdminUser | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const debouncedQ = useDebounced(q, 300)

  const filters = useMemo(
    () => ({
      q: debouncedQ.trim() || undefined,
      role: role || undefined,
      status: status || undefined,
    }),
    [debouncedQ, role, status],
  )

  const { data, isPending, isError, error, isFetching, isFetchingNextPage, hasNextPage, fetchNextPage, refetch } =
    useAdminUsers(filters)

  const users = useMemo(() => data?.pages.flatMap((page) => page.items) ?? [], [data])

  const updateUser = useUpdateUser()
  const removeUser = useDeleteUser()
  const anyActionPending = updateUser.isPending || removeUser.isPending

  const changeRole = (user: AdminUser, roleValue: UserRole) => {
    if (roleValue === user.role) return
    setActionError(null)
    updateUser.mutate(
      { id: user.id, role: roleValue },
      { onError: (err) => setActionError(messageFromError(err)) },
    )
  }

  const changeStatus = (user: AdminUser, statusValue: UserStatus) => {
    if (statusValue === user.status) return
    setActionError(null)
    updateUser.mutate(
      { id: user.id, status: statusValue },
      { onError: (err) => setActionError(messageFromError(err)) },
    )
  }

  const handleDelete = (user: AdminUser) => {
    setActionError(null)
    setDeleteTarget(user)
  }

  const confirmDelete = () => {
    if (!deleteTarget) return
    removeUser.mutate(deleteTarget.id, {
      onSuccess: () => setDeleteTarget(null),
      onError: (err) => setActionError(messageFromError(err)),
    })
  }

  if (me?.role !== 'admin') {
    return <Alert severity="info">Раздел доступен только администраторам.</Alert>
  }

  const fillSx = isMobile
    ? undefined
    : { flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center' }

  return (
    <Stack spacing={2} sx={isMobile ? undefined : { height: '100%', minHeight: 0 }}>
      <Card sx={{ p: 2 }}>
        <FeedbackAdminPanel />
      </Card>

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ alignItems: { sm: 'center' } }}>
        <TextField
          size="small"
          placeholder="Поиск по email…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          sx={{ flex: 1, minWidth: 220 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" sx={{ color: colors.textSecondary }} />
              </InputAdornment>
            ),
          }}
        />
        <TextField
          select
          size="small"
          label="Роль"
          value={role}
          onChange={(e) => setRole(e.target.value as UserRole | '')}
          sx={{ minWidth: 160 }}
        >
          <MenuItem value="">Все</MenuItem>
          {(Object.keys(ROLE_LABEL) as UserRole[]).map((value) => (
            <MenuItem key={value} value={value}>
              {ROLE_LABEL[value]}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          select
          size="small"
          label="Статус"
          value={status}
          onChange={(e) => setStatus(e.target.value as UserStatus | '')}
          sx={{ minWidth: 160 }}
        >
          <MenuItem value="">Все</MenuItem>
          {(Object.keys(STATUS_LABEL) as UserStatus[]).map((value) => (
            <MenuItem key={value} value={value}>
              {STATUS_LABEL[value]}
            </MenuItem>
          ))}
        </TextField>
        {isFetching && !isFetchingNextPage && <CircularProgress size={18} sx={{ color: colors.primary }} />}
      </Stack>

      {actionError && (
        <Alert severity="error" onClose={() => setActionError(null)}>
          {actionError}
        </Alert>
      )}

      {isPending ? (
        <Box sx={fillSx}>
          <LoadingState label="Загружаем пользователей…" />
        </Box>
      ) : isError ? (
        <Box sx={fillSx}>
          <ErrorState message={messageFromError(error)} onRetry={() => void refetch()} />
        </Box>
      ) : users.length === 0 ? (
        <Box sx={fillSx}>
          <EmptyState
            title="Пользователи не найдены"
            subtitle={q || role || status ? 'Попробуйте изменить фильтры' : 'Пока нет ни одного пользователя'}
          />
        </Box>
      ) : isMobile ? (
        <Stack spacing={1.25}>
          {users.map((u) => (
            <AdminUserCard
              key={u.id}
              user={u}
              isMe={u.id === me?.id}
              disabled={anyActionPending}
              onRoleChange={(r) => changeRole(u, r)}
              onStatusChange={(s) => changeStatus(u, s)}
              onDelete={() => handleDelete(u)}
            />
          ))}
        </Stack>
      ) : (
        <TableContainer component={Card} sx={{ flex: 1, minHeight: 0, overflow: 'auto', width: '100%' }}>
          <Table size="small" stickyHeader>
            <TableHead sx={{ '& th': { bgcolor: 'background.paper' } }}>
              <TableRow>
                <TableCell sx={{ width: '100%' }}>Email</TableCell>
                <TableCell>Роль</TableCell>
                <TableCell>Статус</TableCell>
                <TableCell>Регистрация</TableCell>
                <TableCell align="right">Действия</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {users.map((u) => (
                <TableRow key={u.id} hover>
                  <TableCell sx={{ fontWeight: 600 }}>
                    {u.email}
                    {u.id === me?.id && <Chip size="small" label="Это вы" sx={{ ml: 1, height: 20, fontSize: 11 }} />}
                  </TableCell>
                  <TableCell>
                    <TextField
                      select
                      size="small"
                      value={u.role}
                      disabled={anyActionPending || u.id === me?.id}
                      onChange={(e) => changeRole(u, e.target.value as UserRole)}
                      sx={{ minWidth: 132 }}
                    >
                      {(Object.keys(ROLE_LABEL) as UserRole[]).map((value) => (
                        <MenuItem key={value} value={value}>
                          {ROLE_LABEL[value]}
                        </MenuItem>
                      ))}
                    </TextField>
                  </TableCell>
                  <TableCell>
                    <TextField
                      select
                      size="small"
                      value={u.status}
                      disabled={anyActionPending || u.id === me?.id}
                      onChange={(e) => changeStatus(u, e.target.value as UserStatus)}
                      sx={{
                        minWidth: 150,
                        '& .MuiInputBase-input': { color: STATUS_COLORS[u.status], fontWeight: 600 },
                      }}
                    >
                      {(Object.keys(STATUS_LABEL) as UserStatus[]).map((value) => (
                        <MenuItem key={value} value={value}>
                          {STATUS_LABEL[value]}
                        </MenuItem>
                      ))}
                    </TextField>
                  </TableCell>
                  <TableCell sx={{ color: 'text.secondary', fontSize: 13 }}>{formatLongDate(u.created_at)}</TableCell>
                  <TableCell align="right">
                    {u.id === me?.id ? null : (
                      <Tooltip title="Удалить">
                        <span>
                          <IconButton
                            size="small"
                            disabled={anyActionPending}
                            onClick={() => handleDelete(u)}
                            sx={{ color: colors.red }}
                          >
                            <DeleteOutlineIcon fontSize="small" />
                          </IconButton>
                        </span>
                      </Tooltip>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {hasNextPage && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 1 }}>
          <Button variant="outlined" onClick={() => void fetchNextPage()} disabled={isFetchingNextPage}>
            {isFetchingNextPage ? 'Загрузка…' : 'Загрузить ещё'}
          </Button>
        </Box>
      )}

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Удалить пользователя?"
        message={
          deleteTarget ? (
            <>
              Пользователь <strong>{deleteTarget.email}</strong> будет удалён безвозвратно: его сессии
              завершатся, восстановление невозможно.
            </>
          ) : (
            ''
          )
        }
        confirmLabel="Удалить"
        pending={removeUser.isPending}
        error={removeUser.isError ? messageFromError(removeUser.error) : null}
        onConfirm={confirmDelete}
        onClose={() => setDeleteTarget(null)}
      />
    </Stack>
  )
}
