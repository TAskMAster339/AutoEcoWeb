import { useMemo } from 'react'
import {
  Alert,
  Box,
  Card,
  Chip,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material'
import { PageHeader } from '../components/common/PageHeader'
import { useAuthStore } from '../store/authStore'
import { colors } from '../theme'

// TODO(backend): GET /api/v1/admin/users — mock table until the endpoint exists.
const MOCK_USERS = [
  { id: 'u1', email: 'admin@autoeco.ru', role: 'admin' as const, status: 'active' as const },
  { id: 'u2', email: 'test@example.com', role: 'user' as const, status: 'active' as const },
  { id: 'u3', email: 'family@autoeco.ru', role: 'user' as const, status: 'pending' as const },
]

const STATUS_COLORS: Record<string, string> = { active: colors.green, pending: colors.amber, blocked: colors.red }

/** /admin — visible only to admins (route guard). Mock user table. */
export function AdminPage() {
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('md'))
  const user = useAuthStore((s) => s.user)

  const rows = useMemo(() => {
    if (!user) return MOCK_USERS
    const exists = MOCK_USERS.some((u) => u.email === user.email)
    return exists
      ? MOCK_USERS.map((u) => (u.email === user.email ? { ...u, role: user.role, status: user.status } : u))
      : [{ id: user.id, email: user.email, role: user.role, status: user.status }, ...MOCK_USERS]
  }, [user])

  if (user?.role !== 'admin') {
    return (
      <Stack spacing={2}>
        <PageHeader title="Администрирование" />
        <Alert severity="info">Раздел доступен только администраторам.</Alert>
      </Stack>
    )
  }

  return (
    <Stack spacing={2}>
      <PageHeader title="Администрирование" subtitle="Пользователи системы (мок-данные)" />

      <Alert severity="warning" sx={{ '& .MuiAlert-message': { fontSize: 13 } }}>
        Эндпоинт <code>/api/v1/admin/users</code> ещё не реализован бэкендом — таблица показывает мок-данные (см. frontend/TODO.md).
      </Alert>

      {isMobile ? (
        <Stack spacing={1.25}>
          {rows.map((u) => (
            <Card key={u.id} sx={{ p: 1.75, display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="body2" noWrap sx={{ fontWeight: 600 }}>
                  {u.email}
                </Typography>
                <Chip size="small" label={u.role} variant="outlined" sx={{ height: 20, fontSize: 11, mt: 0.5 }} />
              </Box>
              <Chip
                size="small"
                label={u.status}
                sx={{ height: 22, fontSize: 12, bgcolor: `${STATUS_COLORS[u.status] ?? colors.textSecondary}1A`, color: STATUS_COLORS[u.status] ?? colors.textSecondary }}
              />
            </Card>
          ))}
        </Stack>
      ) : (
        <TableContainer component={Card} sx={{ maxWidth: 720 }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Email</TableCell>
                <TableCell>Роль</TableCell>
                <TableCell>Статус</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((u) => (
                <TableRow key={u.id} hover>
                  <TableCell sx={{ fontWeight: 600 }}>{u.email}</TableCell>
                  <TableCell>
                    <Chip size="small" label={u.role} variant="outlined" sx={{ height: 22, fontSize: 12 }} />
                  </TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      label={u.status}
                      sx={{ height: 22, fontSize: 12, bgcolor: `${STATUS_COLORS[u.status] ?? colors.textSecondary}1A`, color: STATUS_COLORS[u.status] ?? colors.textSecondary }}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Stack>
  )
}
