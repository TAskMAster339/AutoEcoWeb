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
import AdminPanelSettingsOutlinedIcon from '@mui/icons-material/AdminPanelSettingsOutlined'
import BlockOutlinedIcon from '@mui/icons-material/BlockOutlined'
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import PersonOffOutlinedIcon from '@mui/icons-material/PersonOffOutlined'
import SearchIcon from '@mui/icons-material/Search'
import { messageFromError } from '../api/client'
import type { AdminUser, UserRole, UserStatus } from '../api/types'
import { ConfirmDialog } from '../components/common/ConfirmDialog'
import { PageHeader } from '../components/common/PageHeader'
import { EmptyState, ErrorState, LoadingState } from '../components/common/States'
import {
  useAdminUsers,
  useDeleteUser,
  useUpdateUserRole,
  useUpdateUserStatus,
} from '../hooks/useAdminUsers'
import { formatLongDate } from '../lib/format'
import { useAuthStore } from '../store/authStore'
import { colors } from '../theme'

const STATUS_COLORS: Record<UserStatus, string> = {
  active: colors.green,
  pending: colors.amber,
  blocked: colors.red,
}

const ROLE_LABEL: Record<UserRole, string> = { admin: 'Админ', user: 'Пользователь' }
const STATUS_LABEL: Record<UserStatus, string> = {
  active: 'Активен',
  pending: 'Ожидает',
  blocked: 'Заблокирован',
}

// Fixed chip WIDTH — not minWidth (a min lets the label grow the chip, a fixed
// width can't) — so a label change (Активен -> Заблокирован, Админ -> Пользователь)
// never shifts the layout. Label padding is zeroed; ellipsis is a safety net.
const CHIP_DESKTOP_SX = {
  height: 22,
  fontSize: 12,
  width: 100,
  px: 0,
  justifyContent: 'center',
  '& .MuiChip-label': { px: 0, overflow: 'hidden', textOverflow: 'ellipsis' },
}
const CHIP_MOBILE_SX = {
  height: 20,
  fontSize: 11,
  width: 88,
  px: 0,
  justifyContent: 'center',
  '& .MuiChip-label': { px: 0, overflow: 'hidden', textOverflow: 'ellipsis' },
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

interface UserActionsProps {
  user: AdminUser
  disabled: boolean
  onActivate: () => void
  onBlock: () => void
  onMakeAdmin: () => void
  onRevokeAdmin: () => void
  onDelete: () => void
}

/** Icon actions row: block/activate, promote/demote, delete. Hidden for the caller's own row. */
function UserActions({ user, disabled, onActivate, onBlock, onMakeAdmin, onRevokeAdmin, onDelete }: UserActionsProps) {
  return (
    <Box sx={{ display: 'flex', gap: 0.25, justifyContent: 'flex-end' }}>
      {user.status === 'active' ? (
        <Tooltip title="Заблокировать">
          <span>
            <IconButton size="small" disabled={disabled} onClick={onBlock}>
              <BlockOutlinedIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
      ) : (
        <Tooltip title="Активировать">
          <span>
            <IconButton size="small" disabled={disabled} onClick={onActivate}>
              <CheckCircleOutlineIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
      )}
      {user.role === 'admin' ? (
        <Tooltip title="Снять админа">
          <span>
            <IconButton size="small" disabled={disabled} onClick={onRevokeAdmin}>
              <PersonOffOutlinedIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
      ) : (
        <Tooltip title="Сделать админом">
          <span>
            <IconButton size="small" disabled={disabled} onClick={onMakeAdmin}>
              <AdminPanelSettingsOutlinedIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
      )}
      <Tooltip title="Удалить">
        <span>
          <IconButton size="small" disabled={disabled} onClick={onDelete} sx={{ color: colors.red }}>
            <DeleteOutlineIcon fontSize="small" />
          </IconButton>
        </span>
      </Tooltip>
    </Box>
  )
}

interface AdminUserRowProps {
  user: AdminUser
  isMe: boolean
  actionsDisabled: boolean
  onActivate: () => void
  onBlock: () => void
  onMakeAdmin: () => void
  onRevokeAdmin: () => void
  onDelete: () => void
}

/** Mobile card: email, role/status chips, registration date, actions. */
function AdminUserCard({ user, isMe, actionsDisabled, ...actions }: AdminUserRowProps) {
  return (
    <Card sx={{ p: 1.5, display: 'flex', alignItems: 'center', gap: 1.5 }}>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="body2" noWrap sx={{ fontWeight: 600 }}>
          {user.email}
        </Typography>
        <Stack direction="row" spacing={0.75} sx={{ mt: 0.75, alignItems: 'center' }}>
          <Chip size="small" label={ROLE_LABEL[user.role]} variant="outlined" sx={CHIP_MOBILE_SX} />
          <Chip
            size="small"
            label={STATUS_LABEL[user.status]}
            sx={{ ...CHIP_MOBILE_SX, bgcolor: `${STATUS_COLORS[user.status]}1A`, color: STATUS_COLORS[user.status] }}
          />
        </Stack>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
          {formatLongDate(user.created_at)}
        </Typography>
      </Box>
      {isMe ? (
        <Chip size="small" label="Это вы" sx={{ height: 20, fontSize: 11 }} />
      ) : (
        <UserActions user={user} disabled={actionsDisabled} {...actions} />
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

  const updateStatus = useUpdateUserStatus()
  const updateRole = useUpdateUserRole()
  const removeUser = useDeleteUser()
  const anyActionPending = updateStatus.isPending || updateRole.isPending || removeUser.isPending

  const handleDelete = (user: AdminUser) => {
    setDeleteTarget(user)
  }

  const confirmDelete = () => {
    if (!deleteTarget) return
    removeUser.mutate(deleteTarget.id, {
      onSuccess: () => setDeleteTarget(null),
    })
  }

  if (me?.role !== 'admin') {
    return (
      <Stack spacing={2}>
        <PageHeader title="Администрирование" />
        <Alert severity="info">Раздел доступен только администраторам.</Alert>
      </Stack>
    )
  }

  const rowActions = (u: AdminUser) => ({
    onActivate: () => updateStatus.mutate({ id: u.id, status: 'active' }),
    onBlock: () => updateStatus.mutate({ id: u.id, status: 'blocked' }),
    onMakeAdmin: () => updateRole.mutate({ id: u.id, role: 'admin' }),
    onRevokeAdmin: () => updateRole.mutate({ id: u.id, role: 'user' }),
    onDelete: () => handleDelete(u),
  })

  const fillSx = isMobile
    ? undefined
    : { flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center' }

  return (
    <Stack spacing={2} sx={isMobile ? undefined : { height: '100%', minHeight: 0 }}>
      <PageHeader
        title="Администрирование"
        subtitle="Пользователи системы"
        actions={
          isFetching && !isFetchingNextPage ? (
            <CircularProgress size={18} sx={{ color: colors.primary }} />
          ) : undefined
        }
      />

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
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
          <MenuItem value="admin">Админ</MenuItem>
          <MenuItem value="user">Пользователь</MenuItem>
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
          <MenuItem value="active">Активен</MenuItem>
          <MenuItem value="pending">Ожидает</MenuItem>
          <MenuItem value="blocked">Заблокирован</MenuItem>
        </TextField>
      </Stack>

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
            <AdminUserCard key={u.id} user={u} isMe={u.id === me?.id} actionsDisabled={anyActionPending} {...rowActions(u)} />
          ))}
        </Stack>
      ) : (
        <TableContainer component={Card} sx={{ flex: 1, minHeight: 0, overflow: 'auto', width: '100%' }}>
          <Table size="small" stickyHeader>
            <TableHead sx={{ '& th': { bgcolor: 'background.paper' } }}>
              <TableRow>
                {/* Email absorbs the free space so the actions column stays compact
                    and its right-aligned header/buttons line up. */}
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
                    <Chip size="small" label={ROLE_LABEL[u.role]} variant="outlined" sx={CHIP_DESKTOP_SX} />
                  </TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      label={STATUS_LABEL[u.status]}
                      sx={{ ...CHIP_DESKTOP_SX, bgcolor: `${STATUS_COLORS[u.status]}1A`, color: STATUS_COLORS[u.status] }}
                    />
                  </TableCell>
                  <TableCell sx={{ color: 'text.secondary', fontSize: 13 }}>{formatLongDate(u.created_at)}</TableCell>
                  <TableCell align="right">
                    {u.id === me?.id ? null : <UserActions user={u} disabled={anyActionPending} {...rowActions(u)} />}
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
