import type { Site } from '@mechane/checks-kernel';
import { lineAt } from '@mechane/modules';
import type { ParsedSource } from '@mechane/modules';
import { Option } from 'effect';
import type { Comment, StaticExport } from 'oxc-parser';
import { DocRule } from './constants.ts';
import { declaringExports } from './declaring-exports.ts';
import { exportNames } from './export-names.ts';
import { isRestating } from './is-restating.ts';
import { lengthMessages } from './length-messages.ts';
import type { AttachedDocs } from './types.ts';

/** What a doc's finding asks for when it holds only its name's words. */
const RESTATING_MESSAGE = 'Say more than the name in its doc, such as `The turns it still owes` for `owedTurns`';

type ShortDocSitesInput = {
  readonly source: ParsedSource;
  readonly docs: ReadonlyArray<Comment>;
  readonly attached: AttachedDocs;
};

type ShortDocSiteInput = { readonly source: ParsedSource; readonly doc: Comment; readonly message: string };

/**
 * Each doc comment past its limits: more sentences than `docSentences`, a sentence of more than `docSentenceWords`
 * words, or a declaring export's doc that holds only its name's words.
 */
export function shortDocSites({ source, docs, attached }: ShortDocSitesInput): ReadonlyArray<Site> {
  /** The doc above a declaring export, when it holds only the words of a name it exports. */
  const restatingDocs: (statement: StaticExport) => ReadonlyArray<Comment> = (statement) => {
    const names = exportNames({ statement });
    const doc = Option.fromNullishOr(attached.get(statement.start));

    return Option.toArray(doc).filter((attachedDoc) => isRestating({ doc: attachedDoc, names }));
  };

  /** The sites of a doc past its sentence or word limits. */
  const lengthSites: (doc: Comment) => ReadonlyArray<Site> = (doc) =>
    lengthMessages({ doc }).map((message) => shortDocSite({ source, doc, message }));

  const restating = declaringExports({ source }).flatMap(restatingDocs);

  return [
    ...docs.flatMap(lengthSites),
    ...restating.map((doc) => shortDocSite({ source, doc, message: RESTATING_MESSAGE })),
  ];
}

/** A site of the short-doc rule at the line its doc opens on. */
function shortDocSite({ source, doc, message }: ShortDocSiteInput): Site {
  return { rule: DocRule.Short, file: source.path, line: lineAt({ text: source.text, offset: doc.start }), message };
}
