const REGEX_SPECIAL_CHARACTERS = /[\\^$.*+?()[\]{}|]/g

export function escapeRegexLiteral(value) {
  return value.replace(REGEX_SPECIAL_CHARACTERS, '\\$&')
}

export function appendAliasPattern(alias, sourceName) {
  const currentPattern = alias.is_regex
    ? alias.original_name
    : escapeRegexLiteral(alias.original_name)
  const sourcePattern = escapeRegexLiteral(sourceName.trim())
  return `${currentPattern}|(${sourcePattern})`
}
