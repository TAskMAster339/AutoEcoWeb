import re


def wildcard_to_regex(pattern: str) -> str:
    """Expand friendly wildcards without touching escapes or character sets."""
    result: list[str] = []
    escaped = False
    in_character_set = False
    previous_was_escaped_atom = False
    for char in pattern:
        if escaped:
            result.append(char)
            escaped = False
            previous_was_escaped_atom = True
            continue
        if char == "\\":
            result.append(char)
            escaped = True
            previous_was_escaped_atom = False
            continue
        if char == "[":
            in_character_set = True
            result.append(char)
            previous_was_escaped_atom = False
            continue
        if char == "]" and in_character_set:
            in_character_set = False
            result.append(char)
            previous_was_escaped_atom = False
            continue
        if not in_character_set and char == "*":
            if not result or result[-1] != ".":
                result.append(".")
            result.append("*")
            previous_was_escaped_atom = False
            continue
        if not in_character_set and char == "?":
            # ``\.?`` is an advanced regex quantifier, not a friendly wildcard.
            result.append("?" if previous_was_escaped_atom else ".")
            previous_was_escaped_atom = False
            continue
        result.append(char)
        previous_was_escaped_atom = False
    return "".join(result)


def compile_wildcard_regex(pattern: str) -> re.Pattern[str]:
    try:
        return re.compile(wildcard_to_regex(pattern), re.IGNORECASE)
    except re.error as exc:
        raise ValueError(str(exc)) from exc
