import type { Alias } from '../api/types'

const REGEX_SPECIAL_CHARACTERS = /[\\^$.*+?()[\]{}|]/g

export function escapeRegexLiteral(value: string): string {
  return value.replace(REGEX_SPECIAL_CHARACTERS, '\\$&')
}

export function appendAliasPattern(alias: Alias, sourceName: string): string {
  const currentPattern = alias.is_regex
    ? alias.original_name
    : escapeRegexLiteral(alias.original_name)
  const sourcePattern = escapeRegexLiteral(sourceName.trim())
  return `${currentPattern}|(${sourcePattern})`
}
