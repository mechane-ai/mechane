import { TYPESCRIPT_EXTENSION } from '@mechane/modules';
import type { ParsedSource } from '@mechane/modules';
import { identifierWords } from '@mechane/program';
import { CONTRACTS } from '@mechane/rules';
import { basename } from 'node:path';
import { Visitor } from 'oxc-parser';
import type { VisitorObject } from 'oxc-parser';
import { proseRuns } from './prose-runs.ts';
import type { WordRun } from './types.ts';

/** A string that spells a name in snake case or kebab case, such as a wire key, a table or a flag, which names hold. */
const NAME_LITERAL = /^[a-z][a-z0-9]*(?:[_-][a-z0-9]+)+$/;

/** The names that keep an external system's own words, such as oxlint's `new-cap`, which no name run holds (NM-05). */
const EXTERNAL_NAMES: ReadonlySet<string> = new Set(CONTRACTS['code-spelled-out-names'].values.externalNames);

type SourceRunsInput = { readonly source: ParsedSource };

/** The runs of a TypeScript file's names, its path, identifiers and name-like strings, and of its comments. */
type SourceRuns = { readonly names: ReadonlyArray<WordRun>; readonly comments: ReadonlyArray<WordRun> };

/**
 * The runs of a TypeScript file's own words. Its names are each folder and the stem of its path, its identifiers, and
 * each string that spells a name, such as a wire key; its comments are prose.
 */
export function sourceRuns({ source }: SourceRunsInput): SourceRuns {
  const names: Array<WordRun> = [];

  /** Keeps an identifier's words, but an external system's name's. */
  const keepIdentifier: NonNullable<VisitorObject['Identifier']> = (node) => {
    if (!EXTERNAL_NAMES.has(node.name)) {
      names.push({ words: identifierWords({ identifier: node.name }), offset: node.start });
    }
  };

  /** Keeps the words of a string that spells a name, but an external system's name's. */
  const keepNameLiteral: NonNullable<VisitorObject['Literal']> = (node) => {
    if (typeof node.value === 'string' && NAME_LITERAL.test(node.value) && !EXTERNAL_NAMES.has(node.value)) {
      names.push({ words: identifierWords({ identifier: node.value }), offset: node.start });
    }
  };

  new Visitor({ Identifier: keepIdentifier, Literal: keepNameLiteral }).visit(source.parsed.program);

  /** The run of one segment of the file's path, its stem's words for the file itself. */
  const segmentRun: (segment: string) => WordRun = (segment) => ({
    words: identifierWords({ identifier: basename(segment, TYPESCRIPT_EXTENSION) }),
    offset: 0,
  });

  return {
    names: [...source.path.split('/').map(segmentRun), ...names],
    comments: source.parsed.comments.flatMap((comment) => proseRuns({ text: comment.value, offset: comment.start })),
  };
}
