import type { StringRename } from '../types.ts';
import { wordPattern } from '../word-pattern.ts';
import { standsAt } from './stands-at.ts';

/** The wire strings that apply to a file, and the part of its text they rewrite. */
type RewriteTextInput = { readonly renames: ReadonlyArray<StringRename>; readonly text: string };

/** A text, and one wire string's rename. */
type ReplaceInput = { readonly text: string; readonly rename: StringRename };

/** The text with each rename applied in the map's order. */
export function rewriteText({ renames, text }: RewriteTextInput): string {
  let rewritten = text;

  for (const rename of renames) {
    rewritten = replace({ text: rewritten, rename });
  }

  return rewritten;
}

/** The text with each whole occurrence of the old string replaced, except where the new one already stands. */
function replace({ text, rename }: ReplaceInput): string {
  /** The new string at a match, or the match where the new one stands already. */
  const replacement: (match: string, offset: number) => string = (match, offset) => {
    if (standsAt({ text, word: rename.to, offset })) {
      return match;
    }

    return rename.to;
  };

  return text.replaceAll(wordPattern({ text: rename.from }), replacement);
}
