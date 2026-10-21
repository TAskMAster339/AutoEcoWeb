import { useCallback, useEffect, useState } from 'react'
import { useDeleteTransaction } from './useTransactions'
import { useUiStore } from '../store/uiStore'
import { toggleSelectedId } from '../lib/transactionInteractions'

/** Owns desktop/mobile selection state and the bulk-delete lifecycle. */
export function useTransactionSelection(isMobile: boolean) {
  const deleteTransaction = useDeleteTransaction()
  const setTransactionSelectionMode = useUiStore((state) => state.setTransactionSelectionMode)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false)
  const [bulkEditOpen, setBulkEditOpen] = useState(false)
  const [mobileSelectionActive, setMobileSelectionActive] = useState(false)
  const [selectionResetRevision, setSelectionResetRevision] = useState(0)
  const [bulkError, setBulkError] = useState<string | null>(null)
  const mobileSelectionMode = isMobile && mobileSelectionActive

  useEffect(() => {
    setTransactionSelectionMode(mobileSelectionMode)
  }, [mobileSelectionMode, setTransactionSelectionMode])

  useEffect(() => () => setTransactionSelectionMode(false), [setTransactionSelectionMode])

  const startMobileSelection = useCallback((id: string) => {
    setMobileSelectionActive(true)
    setSelectedIds([id])
  }, [])

  const toggleMobileSelection = useCallback((id: string) => {
    setSelectedIds((current) => {
      const next = toggleSelectedId(current, id)
      if (next.length === 0) setMobileSelectionActive(false)
      return next
    })
  }, [])

  const closeMobileSelection = useCallback(() => {
    setMobileSelectionActive(false)
    setSelectedIds([])
    setBulkError(null)
  }, [])

  useEffect(() => {
    if (!mobileSelectionMode) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeMobileSelection()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [closeMobileSelection, mobileSelectionMode])

  const resetSelection = useCallback(() => {
    setSelectedIds([])
    setMobileSelectionActive(false)
    setSelectionResetRevision((revision) => revision + 1)
  }, [])

  const bulkDelete = useCallback(async () => {
    setBulkError(null)
    try {
      await Promise.all(selectedIds.map((id) => deleteTransaction.mutateAsync(id)))
      resetSelection()
      setConfirmDeleteOpen(false)
    } catch (error) {
      setBulkError(error instanceof Error ? error.message : 'Не удалось удалить транзакции')
    }
  }, [deleteTransaction, resetSelection, selectedIds])

  return {
    selectedIds,
    setSelectedIds,
    confirmDeleteOpen,
    setConfirmDeleteOpen,
    bulkEditOpen,
    setBulkEditOpen,
    selectionResetRevision,
    bulkError,
    setBulkError,
    mobileSelectionMode,
    startMobileSelection,
    toggleMobileSelection,
    closeMobileSelection,
    resetSelection,
    bulkDelete,
    deletePending: deleteTransaction.isPending,
  }
}
