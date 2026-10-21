type RefreshTransactionDatasource = () => void

const refreshers = new Set<RefreshTransactionDatasource>()

/** Registers an imperative view cache (currently AG Grid) with the domain layer. */
export function registerTransactionDatasource(refresh: RefreshTransactionDatasource): () => void {
  refreshers.add(refresh)
  return () => refreshers.delete(refresh)
}

export function refreshTransactionDatasources(): void {
  for (const refresh of refreshers) refresh()
}
