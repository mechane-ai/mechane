import { siteKey } from '@mechane/checks-kernel';
import type { Finding } from '@mechane/checks-kernel';
import { CONTRACTS } from '@mechane/rules';

/** One TypeScript source file, read whole. */
type SourceFile = { readonly path: string; readonly text: string };

/** A line of a comment: one that starts with `//`, `/**` or the `*` of a block comment's body. */
const COMMENT_LINE = /^\s*(\/\/|\/\*|\*)/;

type CommentWidthInput = { readonly file: SourceFile };

/** Finds each comment line wider than the declared line width, since the formatter wraps code and never a comment. */
export function commentWidthFindings({ file }: CommentWidthInput): ReadonlyArray<Finding> {
  const { lineChars } = CONTRACTS['code-comment-form'].values;

  /** The finding of a comment line past the width, by its place among the file's lines. */
  const lineFindings: (line: string, index: number) => ReadonlyArray<Finding> = (line, index) => {
    if (line.length <= lineChars || !COMMENT_LINE.test(line)) {
      return [];
    }

    return [
      {
        check: 'comment-width',
        location: siteKey({ file: file.path, line: index + 1 }),
        message: `Wrap the comment within ${lineChars} characters, such as \`// the rest\` on a line of its own`,
      },
    ];
  };

  return file.text.split('\n').flatMap(lineFindings);
}
