import { describe, expect, it } from 'vitest'

import { appendAliasPattern, escapeRegexLiteral } from '../src/lib/aliasPatterns'

describe('alias patterns', () => {
  it('preserves a product name as literal text', () => {
    expect(escapeRegexLiteral('Йогурт (2.5%) + мюсли?')).toBe('Йогурт \\(2\\.5%\\) \\+ мюсли\\?')
  })

  it('converts a plain alias to a safe regex', () => {
    expect(appendAliasPattern(
      { original_name: 'Активиа 2.5%', is_regex: false },
      'Йогурт (260 г)',
    )).toBe('Активиа 2\\.5%|(Йогурт \\(260 г\\))')
  })

  it('keeps an existing regex intact', () => {
    expect(appendAliasPattern(
      { original_name: '^сырок\\s+', is_regex: true },
      'Сырок + какао',
    )).toBe('^сырок\\s+|(Сырок \\+ какао)')
  })
})
