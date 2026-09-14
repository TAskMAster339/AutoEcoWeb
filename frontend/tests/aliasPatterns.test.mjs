import assert from 'node:assert/strict'
import test from 'node:test'

import { appendAliasPattern, escapeRegexLiteral } from '../src/lib/aliasPatterns.mjs'

test('escapeRegexLiteral preserves a product name as literal text', () => {
  assert.equal(escapeRegexLiteral('Йогурт (2.5%) + мюсли?'), 'Йогурт \\(2\\.5%\\) \\+ мюсли\\?')
})

test('appendAliasPattern converts a plain alias to a safe regex', () => {
  assert.equal(
    appendAliasPattern({ original_name: 'Активиа 2.5%', is_regex: false }, 'Йогурт (260 г)'),
    'Активиа 2\\.5%|(Йогурт \\(260 г\\))',
  )
})

test('appendAliasPattern keeps an existing regex intact', () => {
  assert.equal(
    appendAliasPattern({ original_name: '^сырок\\s+', is_regex: true }, 'Сырок + какао'),
    '^сырок\\s+|(Сырок \\+ какао)',
  )
})
