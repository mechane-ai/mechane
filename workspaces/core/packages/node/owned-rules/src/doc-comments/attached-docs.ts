import type { Comment } from 'oxc-parser';
import type { AttachedDocs } from './types.ts';

/**
 * The whitespace after a doc comment, and each line that suppresses an ast-grep or oxlint rule on the next line. A
 * suppressed declaration holds them between its doc and its code.
 */
const DOC_GAP = /^(?:\s*\/\/ (?:ast-grep-ignore|oxlint-disable-next-line)\b[^\n]*)*\s*/;

type AttachedDocsInput = { readonly text: string; readonly docs: ReadonlyArray<Comment> };

/**
 * Each doc comment by the offset of the first code after it; any other comment or code between them detaches it, but a
 * suppression of the next line does not.
 */
export function attachedDocs({ text, docs }: AttachedDocsInput): AttachedDocs {
  /** A doc comment under the offset of the code after its gap. */
  const attachedEntry: (doc: Comment) => readonly [number, Comment] = (doc) => {
    const rest = text.slice(doc.end);

    return [doc.end + rest.length - rest.replace(DOC_GAP, '').length, doc];
  };

  return new Map(docs.map(attachedEntry));
}
