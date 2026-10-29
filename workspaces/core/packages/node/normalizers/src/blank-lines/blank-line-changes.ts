import type { FileChange } from '@mechane/checks-kernel';
import { editedText, inScope } from '@mechane/modules';
import type { NormalizerScope, ParsedSource, TextEdit } from '@mechane/modules';
import { Option } from 'effect';
import { blankLineGaps } from './blank-line-gaps.ts';

/** Every TypeScript file of the members, and the files whose statements the normalizer spaces. */
type BlankLineChangesInput = { readonly sources: ReadonlyArray<ParsedSource>; readonly scope: NormalizerScope };

/**
 * The blank-lines normalizer's changes: each file under the scope with a line inserted at each gap, which changes no
 * behavior.
 */
export function blankLineChanges({ sources, scope }: BlankLineChangesInput): ReadonlyArray<FileChange> {
  /** A file's change, or none when it lacks no blank line. */
  const fileChanges: (source: ParsedSource) => ReadonlyArray<FileChange> = (source) => {
    const gaps = blankLineGaps({ source });

    if (gaps.length === 0) {
      return [];
    }

    /** The edit that inserts a line break at a gap, which leaves an empty line there. */
    const lineBreak: (offset: number) => TextEdit = (offset) => ({ start: offset, end: offset, text: '\n' });
    const edits = gaps.map(lineBreak);
    const text = editedText({ text: source.text, edits });

    return [{ path: source.path, text: Option.some(text) }];
  };

  return sources.filter(({ path }) => inScope({ path, scope })).flatMap(fileChanges);
}
