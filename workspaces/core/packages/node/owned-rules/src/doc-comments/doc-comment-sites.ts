import type { Site } from '@mechane/checks-kernel';
import type { ParsedSource } from '@mechane/modules';
import type { Comment } from 'oxc-parser';
import { absenceDocSites } from './absence-doc-sites.ts';
import { attachedDocs } from './attached-docs.ts';
import { exportDocSites } from './export-doc-sites.ts';
import { shortDocSites } from './short-doc-sites.ts';

/** The kind oxc gives a block comment, which is a doc comment when it opens with a second asterisk. */
const BLOCK_COMMENT = 'Block';

/** The second asterisk that opens a doc comment, the first character of its block comment's value. */
const DOC_OPENING = '*';

type DocCommentSitesInput = { readonly source: ParsedSource };

/** Every site of the doc comment rules in one file: exports without a doc, unexplained absent fields, and long docs. */
export function docCommentSites({ source }: DocCommentSitesInput): ReadonlyArray<Site> {
  /** Whether the comment is a doc comment. */
  const isDoc: (comment: Comment) => boolean = ({ type, value }) =>
    type === BLOCK_COMMENT && value.startsWith(DOC_OPENING);

  const docs = source.parsed.comments.filter(isDoc);
  const attached = attachedDocs({ text: source.text, docs });

  return [
    ...exportDocSites({ source, attached }),
    ...absenceDocSites({ source, attached }),
    ...shortDocSites({ source, docs, attached }),
  ];
}
