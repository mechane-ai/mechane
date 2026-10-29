import type { Comment } from 'oxc-parser';

/** The margin a doc comment's line opens with: its indent and its `*`. */
const DOC_MARGIN = /^\s*\*?/;

/** The mark a tag line opens with, such as `@public`. */
const TAG_MARK = '@';

type DocTextInput = { readonly doc: Comment };

/** A doc comment's prose on one line, without its `*` margins and without its tag lines, such as `@public`. */
export function docText({ doc }: DocTextInput): string {
  /** A line of the doc without its margin and its surrounding space. */
  const bareLine: (line: string) => string = (line) => line.replace(DOC_MARGIN, '').trim();
  /** Whether a bare line is prose rather than a tag. */
  const isProse: (line: string) => boolean = (line) => !line.startsWith(TAG_MARK);

  return doc.value.slice(1).split('\n').map(bareLine).filter(isProse).join(' ').trim();
}
