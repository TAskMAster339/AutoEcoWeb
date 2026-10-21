from __future__ import annotations

from dataclasses import dataclass

import regex

_MATCH_TIMEOUT_SECONDS = 0.02
_MAX_REGEX_OPERATORS = 64


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


def _validate_complexity(pattern: str) -> None:
    """Reject constructs most commonly used for catastrophic backtracking.

    The runtime timeout remains the final safety boundary. This validation is
    deliberately conservative so unsafe rules are rejected when saved rather
    than repeatedly timing out while applying aliases.
    """
    operators = 0
    escaped = False
    in_character_set = False
    group_has_repeat: list[bool] = []
    index = 0
    while index < len(pattern):
        char = pattern[index]
        if escaped:
            escaped = False
            index += 1
            continue
        if char == "\\":
            escaped = True
            index += 1
            continue
        if char == "[":
            in_character_set = True
            index += 1
            continue
        if char == "]" and in_character_set:
            in_character_set = False
            index += 1
            continue
        if in_character_set:
            index += 1
            continue

        is_repeat = char in "*+?"
        if char == "?" and index > 0 and pattern[index - 1] == "(":
            is_repeat = False
        if char == "{":
            closing = pattern.find("}", index + 1)
            is_repeat = closing != -1
            if is_repeat:
                index = closing

        if char == "(":
            group_has_repeat.append(False)
        elif char == ")":
            repeated_inside = group_has_repeat.pop() if group_has_repeat else False
            next_index = index + 1
            next_is_repeat = next_index < len(pattern) and pattern[next_index] in "*+?{"
            if repeated_inside and next_is_repeat:
                raise ValueError("Nested regex quantifiers are not allowed")
            if repeated_inside and group_has_repeat:
                group_has_repeat[-1] = True
        elif is_repeat:
            operators += 1
            if group_has_repeat:
                group_has_repeat[-1] = True
        elif char == "|":
            operators += 1

        if operators > _MAX_REGEX_OPERATORS:
            raise ValueError("Regex is too complex")
        index += 1


@dataclass(frozen=True, slots=True)
class SafeRegex:
    _compiled: regex.Pattern[str]

    def search(self, value: str):
        try:
            return self._compiled.search(value, timeout=_MATCH_TIMEOUT_SECONDS)
        except TimeoutError:
            return None


def compile_wildcard_regex(pattern: str) -> SafeRegex:
    expanded = wildcard_to_regex(pattern)
    _validate_complexity(expanded)
    try:
        return SafeRegex(regex.compile(expanded, regex.IGNORECASE))
    except regex.error as exc:
        raise ValueError(str(exc)) from exc
