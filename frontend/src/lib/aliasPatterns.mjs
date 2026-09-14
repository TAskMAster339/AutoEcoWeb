const REGEX_SPECIAL_CHARACTERS = /[\\^$.*+?()[\]{}|]/g

export function escapeRegexLiteral(value) {
  return value.replace(REGEX_SPECIAL_CHARACTERS, '\\$&')
}

export function appendAliasPattern(alias, productName) {
  const currentPattern = alias.is_regex
    ? alias.original_name
    : escapeRegexLiteral(alias.original_name)
  const productPattern = escapeRegexLiteral(productName.trim())
  return `${currentPattern}|(${productPattern})`
}
