import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import {
  clampSwipeOffset,
  detectSwipeAxis,
  hasActiveTableFilters,
  matchesOptionSearch,
  medianOf,
  nextOpenSwipeId,
  replaceQuickEditTarget,
  selectionRange,
  settleSwipe,
  swipeEditAction,
} from '../src/lib/transactionInteractions.mjs'

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

test('vertical movement does not hijack page scrolling', () => {
  assert.equal(detectSwipeAxis(5, 40), 'vertical')
  assert.equal(detectSwipeAxis(-40, 5), 'horizontal')
})

test('numeric column median handles odd, even and empty data', () => {
  assert.equal(medianOf([]), null)
  assert.equal(medianOf([9, 1, 5]), 5)
  assert.equal(medianOf([8, 2, 4, 6]), 5)
})
