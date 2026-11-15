---
name: cangjie-oracle
description: Answer questions about Cangjie codes and character decompositions for the 300 Ghost Script characters by calling the Oracle tools, never from memory.
---

# Cangjie Oracle

The Oracle reads one checked dataset (`app/public/data/characters.json`). Cangjie codes come from Unicode Unihan (`kCangjie`, Unicode 18.0.0, marked provisional by Unihan). Decompositions come from Make Me a Hanzi.

## Rule

Never state a Cangjie code or a character decomposition from memory. Say only what a tool returned. If a tool has not been called for the character, call it first.

## When to call each tool

- `lookup(character)`: the user asks for the Cangjie code of a character, or whether it is playable in the game. Returns the stored code, its source and a `playable` flag. A code starting with `X` is returned as stored and is not playable.
- `verify(character, code)`: the user gives a code and wants to know if it is right. The code is upper-cased, then checked (letters A to Y, 1 to 5 long). The result has `matches` and `normalisedCode`. It does not return the stored code; call `lookup` for that.
- `decompose(character)`: the user asks how a character is built. Returns the IDS string, the radical, the components and whether the character is atomic.

## Not found and errors

- `found: false` means the character is "not in the dataset". Say that. Do not guess a code or a decomposition, and do not fill the gap from memory.
- `cangjie: null` or `reason: no-code-in-source` means the source has no code for that character. Say so.
- An error result (`isError`) means the input was invalid. Give the person the message and ask for one CJK character, or a code of letters A to Y.

## Reporting

Name the source with each answer (Unihan `kCangjie` for codes, Make Me a Hanzi for decompositions). Some typists know different codes for some characters, so describe the code as the one in this dataset's source.
