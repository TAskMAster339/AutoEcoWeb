import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import {
  canStartMobileSelection,
  clampSwipeOffset,
  detectSwipeAxis,
  hasActiveTableFilters,
  matchesOptionSearch,
  medianOf,
  nextOpenSwipeId,
  replaceQuickEditTarget,
  replaceTransactionInPlace,
  selectionRange,
  settleSwipe,
  swipeEditAction,
  toggleSelectedId,
} from '../src/lib/transactionInteractions.mjs'
import {
  createFrameScheduler,
  createRequestGate,
  isNearScrollEnd,
  nextPageOffset,
} from '../src/lib/mobilePagination.mjs'
import { getKeyboardViewport } from '../src/lib/visualViewport.mjs'

const transactionView = (id, balance, expense) => ({
  id,
  date: '2025-01-01',
  store: 'Магазин',
  sellerId: null,
  sellerNameSource: null,
  sellerAliasName: null,
  tagId: null,
  name: id,
  nameSource: id,
  nameAliasName: null,
  comment: null,
  quantity: 1,
  price: expense,
  income: null,
  expense,
  balance,
})

test('only the latest swiped card remains open', () => {
  let openId = nextOpenSwipeId('first')
  openId = nextOpenSwipeId('second')
  assert.equal(openId, 'second')
})

test('a right swipe closes an already open action', () => {
  const offset = clampSwipeOffset(-88, 70)
  assert.equal(settleSwipe('horizontal', offset, true), false)
})

test('edit action closes swipe and requests editor immediately', () => {
  assert.deepEqual(swipeEditAction(), { openSwipeId: null, shouldEdit: true })
})

test('mobile selection toggles cards without changing the remaining order', () => {
  assert.deepEqual(toggleSelectedId(['a', 'c'], 'b'), ['a', 'c', 'b'])
  assert.deepEqual(toggleSelectedId(['a', 'c', 'b'], 'c'), ['a', 'b'])
  assert.deepEqual(toggleSelectedId(['a'], 'a'), [])
})

test('mobile selection cannot start while the transaction editor opens or is open', () => {
  assert.equal(canStartMobileSelection(false, false), true)
  assert.equal(canStartMobileSelection(false, true), false)
  assert.equal(canStartMobileSelection(true, false), false)
})

test('mobile pagination starts before the app scroll frame reaches the end', () => {
  assert.equal(isNearScrollEnd(4120, 800, 5200), true)
  assert.equal(isNearScrollEnd(4000, 800, 5200), false)
  assert.equal(isNearScrollEnd(-40, 800, 5200), false)
})

test('mobile pagination advances by received rows and stops at the total', () => {
  const firstPage = { items: Array.from({ length: 50 }), total: 79 }
  const lastPage = { items: Array.from({ length: 29 }), total: 79 }

  assert.equal(nextPageOffset([firstPage]), 50)
  assert.equal(nextPageOffset([firstPage, lastPage]), undefined)
  assert.equal(nextPageOffset([{ items: [], total: 79 }]), undefined)
})

test('scroll checks are coalesced into one animation frame', () => {
  let callbackCount = 0
  let requestCount = 0
  let queuedFrame = null
  const scheduler = createFrameScheduler(
    () => { callbackCount += 1 },
    (callback) => {
      requestCount += 1
      queuedFrame = callback
      return requestCount
    },
    () => { queuedFrame = null },
  )

  scheduler.schedule()
  scheduler.schedule()
  scheduler.schedule()
  assert.equal(requestCount, 1)
  queuedFrame(0)
  assert.equal(callbackCount, 1)
})

test('an active page request is shared instead of started twice', async () => {
  let requestCount = 0
  let resolveRequest
  const request = createRequestGate(() => {
    requestCount += 1
    return new Promise((resolve) => { resolveRequest = resolve })
  })

  const first = request()
  const second = request()
  await Promise.resolve()
  assert.equal(requestCount, 1)
  resolveRequest('done')
  assert.equal(await first, 'done')
  assert.equal(await second, 'done')

  const third = request()
  await Promise.resolve()
  assert.equal(requestCount, 2)
  resolveRequest('again')
  assert.equal(await third, 'again')
})

test('keyboard viewport handles overlay and resized mobile browsers without double offset', () => {
  assert.deepEqual(getKeyboardViewport(800, 480, 0, 800), {
    keyboardOpen: true,
    bottomInset: 320,
    maxHeight: 472,
  })
  assert.deepEqual(getKeyboardViewport(480, 480, 0, 800), {
    keyboardOpen: true,
    bottomInset: 0,
    maxHeight: 472,
  })
  assert.deepEqual(getKeyboardViewport(800, 760, 0, 800), {
    keyboardOpen: false,
    bottomInset: 0,
    maxHeight: 752,
  })
})

test('an in-place transaction update preserves order and adjusts following balances', () => {
  const rows = [transactionView('first', -100, 100), transactionView('second', -150, 50)]
  const updated = { ...rows[0], name: 'Изменено', expense: 120, balance: 0 }
  const result = replaceTransactionInPlace(rows, updated)

  assert.deepEqual(result.map((row) => row.id), ['first', 'second'])
  assert.equal(result[0].name, 'Изменено')
  assert.equal(result[0].balance, -120)
  assert.equal(result[1].balance, -170)
})

test('right click replaces the previous quick-edit target', () => {
  const current = { id: 'one', field: 'tagId' }
  const next = { id: 'two', field: 'store' }
  assert.equal(replaceQuickEditTarget(current, next), next)
})

test('Alt can toggle one row and Shift produces an inclusive range', () => {
  const selected = new Set()
  selected.add(3)
  selected.delete(3)
  assert.equal(selected.size, 0)
  assert.deepEqual(selectionRange(2, 5), [2, 3, 4, 5])
  assert.deepEqual(selectionRange(5, 2), [2, 3, 4, 5])
})

test('store and tag search are case-insensitive and support Cyrillic', () => {
  assert.equal(matchesOptionSearch('Пятёрочка', 'пят'), true)
  assert.equal(matchesOptionSearch('RU Напитки', 'напит'), true)
  assert.equal(matchesOptionSearch('Steam', 'магазин'), false)
})

test('period alone does not enable the filter dot', () => {
  const empty = {
    search: '', tagFilterIds: [], untaggedOnly: false, storeFilters: [], amountMin: '', amountMax: '', operationFilter: 'all',
  }
  assert.equal(hasActiveTableFilters(empty), false)
  assert.equal(hasActiveTableFilters({ ...empty, search: 'кофе' }), true)
  assert.equal(hasActiveTableFilters({ ...empty, untaggedOnly: true }), true)
})

test('reduced-motion stylesheet keeps feedback without spatial movement', async () => {
  const css = await readFile(new URL('../src/index.css', import.meta.url), 'utf8')
  const mediaBlock = css.slice(css.indexOf('@media (prefers-reduced-motion: reduce)'))
  assert.match(mediaBlock, /mobile-transaction-card--enter/)
  assert.match(mediaBlock, /mobile-card-fade/)
  assert.match(mediaBlock, /transition-duration:\s*100ms\s*!important/)
})

test('receipt import refreshes paged transactions and their total before reloading the list', async () => {
  const source = await readFile(
    new URL('../src/components/transactions/AddReceiptSheet.tsx', import.meta.url),
    'utf8',
  )
  const removePageCache = source.indexOf("removeQueries({ queryKey: userQueryKey('txPage') })")
  const notifyViews = source.indexOf("setQueryData<number>(userQueryKey('txRevision')")

  assert.notEqual(removePageCache, -1)
  assert.notEqual(notifyViews, -1)
  assert.ok(removePageCache < notifyViews)
  assert.match(source, /invalidateQueries\(\{ queryKey: userQueryKey\('txTotal'\) \}\)/)
})

test('vertical movement does not hijack page scrolling', () => {
  assert.equal(detectSwipeAxis(5, 40), 'vertical')
  assert.equal(detectSwipeAxis(-40, 5), 'horizontal')
})

test('numeric column median handles odd, even and empty data', () => {
  assert.equal(medianOf([]), null)
  assert.equal(medianOf([9, 1, 5]), 5)
  assert.equal(medianOf([8, 2, 4, 6]), 5)
})
