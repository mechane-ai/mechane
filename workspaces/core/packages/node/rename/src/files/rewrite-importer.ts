import { relativeSpecifier } from '@mechane/program';
import { Effect } from 'effect';
import { dirname, resolve } from 'node:path';
import type { FileFailed } from '../errors.ts';
import { readText } from './read-text.ts';
import { writeText } from './write-text.ts';

/** A relative import specifier and the text before it, such as `from './show-trace.ts'`. */
const RELATIVE_SPECIFIER = /((?:from\s+|import\()')(\.{1,2}\/[^']+)'/g;

/** An importer's path and a moved file's old and new absolute paths. */
type RewriteImporterInput = { readonly importer: string; readonly from: string; readonly to: string };

/** An importer's path and text, and a moved file's old and new absolute paths. */
type RewriteImportsInput = {
  readonly importer: string;
  readonly text: string;
  readonly from: string;
  readonly to: string;
};

/** Points the importer's relative imports of the moved file at its new path, writing it only when they change. */
export const rewriteImporter = Effect.fn('rewriteImporter')(function* ({
  importer,
  from,
  to,
}: RewriteImporterInput): Effect.fn.Return<void, FileFailed> {
  const text = yield* readText({ path: importer });
  const rewritten = rewriteImports({ importer, text, from, to });

  if (rewritten !== text) {
    yield* writeText({ path: importer, text: rewritten });
  }
});

/** The importer's text with each relative specifier of the moved file's old path naming its new one. */
function rewriteImports({ importer, text, from, to }: RewriteImportsInput): string {
  /** The specifier's import, naming the moved file's new path where it named its old one. */
  const replacement: (whole: string, lead: string, specifier: string) => string = (whole, lead, specifier) => {
    if (resolve(dirname(importer), specifier) !== from) {
      return whole;
    }

    return `${lead}${relativeSpecifier({ importer, target: to })}'`;
  };

  return text.replaceAll(RELATIVE_SPECIFIER, replacement);
}
