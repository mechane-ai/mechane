import type { Finding, TextFile } from '@mechane/checks-kernel';
import { Record } from 'effect';
import { DOCUMENT_WORDS, UNBUDGETED_DOCUMENTS } from './constants.ts';
import { proseFindings } from './prose-findings.ts';

type DocumentFindingsInput = { readonly files: ReadonlyArray<TextFile> };

/** The prose findings of each document among `files` that the check reads, a budgeted one's against its budget. */
export function documentFindings({ files }: DocumentFindingsInput): ReadonlyArray<Finding> {
  /** Whether the check reads the file: a document with a budget, or one whose prose alone it reads. */
  const isDocument: (file: TextFile) => boolean = ({ path }) =>
    Record.has(DOCUMENT_WORDS, path) || UNBUDGETED_DOCUMENTS.includes(path);

  /** A document's findings, against its budget if it has one. */
  const fileFindings: (file: TextFile) => ReadonlyArray<Finding> = ({ path, text }) =>
    proseFindings({ path, text, maxWords: Record.get(DOCUMENT_WORDS, path) });

  return files.filter(isDocument).flatMap(fileFindings);
}
