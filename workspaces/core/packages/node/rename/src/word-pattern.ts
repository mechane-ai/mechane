/** A character that continues an identifier, so a match beside one is part of a longer name. */
const WORD_CHARACTER = /[\w$]/;

/** The guards that keep a match from continuing an identifier on the side where the text starts or ends a word. */
const WordGuard = { Before: String.raw`(?<![\w$])`, After: String.raw`(?![\w$])` } as const;

/** The characters a regular expression reads as syntax, which a literal text escapes. */
const PATTERN_SYNTAX = /[.*+?^${}()|[\]\\]/g;

type TextInput = { readonly text: string };

type EdgeGuardInput = { readonly character: string; readonly guard: string };

/**
 * A global pattern that matches the text as written. Where the text starts or ends with an identifier character, a
 * match beside another one does not count, so `showDrone` never matches inside `readDrones`.
 */
export function wordPattern({ text }: TextInput): RegExp {
  const before = edgeGuard({ character: text.slice(0, 1), guard: WordGuard.Before });
  const after = edgeGuard({ character: text.slice(-1), guard: WordGuard.After });

  return new RegExp(`${before}${text.replaceAll(PATTERN_SYNTAX, String.raw`\$&`)}${after}`, 'g');
}

/** The guard of an edge of the text, which only an identifier character at that edge needs. */
function edgeGuard({ character, guard }: EdgeGuardInput): string {
  if (!WORD_CHARACTER.test(character)) {
    return '';
  }

  return guard;
}
