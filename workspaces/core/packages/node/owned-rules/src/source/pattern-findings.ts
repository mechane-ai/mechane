import type { Finding } from '@mechane/checks-kernel';
import type { ParsedSource } from '@mechane/modules';
import { CONTRACTS } from '@mechane/rules';
import { Visitor } from 'oxc-parser';
import type { VisitorObject } from 'oxc-parser';

type PatternsInput = { readonly files: ReadonlyArray<ParsedSource> };

type RegexLiteralsInput = { readonly file: ParsedSource };

/** One regular expression literal and the file that writes it. */
type PatternUse = { readonly pattern: string; readonly path: string };

/** A pattern and the files that write it. */
type PatternPaths = { readonly pattern: string; readonly paths: ReadonlyArray<string> };

/** Finds each regular expression of the declared minimum length that two or more source files write. */
export function patternFindings({ files }: PatternsInput): ReadonlyArray<Finding> {
  const { patternChars } = CONTRACTS['code-shared-definitions'].values;
  const uses = files.flatMap((file) => regexLiterals({ file })).filter((use) => use.pattern.length >= patternChars);
  const byPattern = Map.groupBy(uses, (use) => use.pattern);

  /** A pattern and each file that writes it, once. */
  const patternPaths: (group: readonly [string, ReadonlyArray<PatternUse>]) => PatternPaths = ([pattern, used]) => ({
    pattern,
    paths: [...new Set(used.map((use) => use.path))],
  });

  /** The finding of a pattern two or more files write. */
  const patternFinding: (repeated: PatternPaths) => Finding = ({ pattern, paths }) => ({
    check: 'patterns',
    location: paths.join(', '),
    message: `Declare /${pattern}/ once and import it in each file, such as \`export const ID_PATTERN = /^[a-z]+$/\``,
  });

  return [...byPattern]
    .map(patternPaths)
    .filter(({ paths }) => paths.length > 1)
    .map(patternFinding);
}

/** Each regular expression literal a file writes. */
function regexLiterals({ file }: RegexLiteralsInput): ReadonlyArray<PatternUse> {
  const uses: Array<PatternUse> = [];

  /** Keeps a literal that is a regular expression. */
  const keepRegex: NonNullable<VisitorObject['Literal']> = (node) => {
    if ('regex' in node) {
      uses.push({ pattern: node.regex.pattern, path: file.path });
    }
  };

  new Visitor({ Literal: keepRegex }).visit(file.parsed.program);

  return uses;
}
