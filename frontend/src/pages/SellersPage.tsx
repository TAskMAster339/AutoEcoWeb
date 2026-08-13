import { useMemo, useState } from 'react'
import { Box, Button, Card, Dialog, DialogActions, DialogContent, Stack, TextField, Typography } from '@mui/material'

import StorefrontOutlinedIcon from '@mui/icons-material/StorefrontOutlined'
import { useNavigate } from 'react-router-dom'
import { useSellers, useUpdateSeller, useDeleteSeller } from '../hooks/useSellers'
import { useOnline } from '../hooks/useOnline'
import { LoadingState, EmptyState, ErrorState, OfflineState } from '../components/common/States'
import type { ManagedStore } from '../api/types'
import { PageSearch } from '../components/common/PageSearch'

export function SellersPage() {
  const navigate = useNavigate()
  const online = useOnline()
  const sellers = useSellers()
  const update = useUpdateSeller()
  const remove = useDeleteSeller()
  const [editing, setEditing] = useState<ManagedStore | null>(null)
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  const openEdit = (seller: ManagedStore) => { setEditing(seller); setName(seller.seller_name); setError(null) }
  const save = async () => {
    if (!editing || !name.trim()) return setError('Укажите название магазина')
    try { await update.mutateAsync({ id: editing.seller_id, name: name.trim() }); setEditing(null) }
    catch (e) { setError(e instanceof Error ? e.message : 'Не удалось изменить магазин') }
  }
  const rows = useMemo(() => (sellers.data ?? []).filter((seller) => {
    const label = seller.alias_name || seller.normalized_seller_name || seller.seller_name
    return label.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase())
  }), [search, sellers.data])

  if (sellers.isLoading) return <LoadingState label="Загружаем магазины…" />
  if (!online) return <OfflineState onRetry={() => void sellers.refetch()} />
  if (sellers.isError) return <ErrorState message="Не удалось загрузить магазины" onRetry={() => void sellers.refetch()} />

  return <Stack spacing={2}>
    <PageSearch value={search} onChange={setSearch} placeholder="Поиск по названию магазина" ariaLabel="Поиск по названию магазина" width="100%" />
    {rows.length === 0 ? <EmptyState title="Магазинов пока нет" subtitle="Магазины появятся после добавления транзакций или чеков" /> :
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 1.5 }}>
        {rows.map((seller) => {
          const label = seller.alias_name || seller.normalized_seller_name || seller.seller_name
          return <Card key={seller.seller_id} sx={{ minHeight: 220, p: 2, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', borderRadius: '8px' }}>
            <Box component="button" onClick={() => navigate(`/transactions?store=${encodeURIComponent(seller.filter_value)}`)} sx={{ border: 0, bgcolor: 'transparent', textAlign: 'left', p: 0, cursor: 'pointer' }}>
              <Box title={`Открыть транзакции магазина «${label}»`}><StorefrontOutlinedIcon color="primary" sx={{ fontSize: 42, mb: 2 }} /></Box>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>{label}</Typography>
              {seller.alias_name && <Typography variant="caption" color="text.secondary">Правило: {seller.seller_name}</Typography>}
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>{seller.transaction_count} транзакций · {seller.receipt_count} чеков</Typography>
            </Box>
            <Stack direction="row" spacing={0.75} sx={{ mt: 2, justifyContent: 'space-between' }}>
              <Button
                size="small"
                variant="outlined"
                onClick={() => openEdit(seller)}
                aria-label={`Изменить магазин ${label}`}
                sx={{ borderRadius: '6px', textTransform: 'none', px: 1.25, py: 0.5, minWidth: 0 }}
              >
                Изменить
              </Button>
              <Button
                size="small"
                variant="outlined"
                color="error"
                disabled={seller.transaction_count + seller.receipt_count > 0 || remove.isPending}
                onClick={() => void remove.mutateAsync(seller.seller_id)}
                aria-label={`Удалить магазин ${label}`}
                sx={{ borderRadius: '6px', textTransform: 'none', px: 1.25, py: 0.5, minWidth: 0 }}
              >
                Удалить
              </Button>
            </Stack>
          </Card>
        })}
      </Box>}
    <Dialog open={editing !== null} onClose={() => setEditing(null)} fullWidth maxWidth="xs">
      <DialogContent><Stack spacing={2}><Typography variant="h6">Изменить магазин</Typography>{error && <Typography color="error">{error}</Typography>}<TextField label="Название" value={name} onChange={(e) => setName(e.target.value)} autoFocus fullWidth /></Stack></DialogContent>
      <DialogActions><Button onClick={() => setEditing(null)}>Отмена</Button><Button variant="contained" onClick={() => void save()} disabled={update.isPending}>Сохранить</Button></DialogActions>
    </Dialog>
  </Stack>
}
