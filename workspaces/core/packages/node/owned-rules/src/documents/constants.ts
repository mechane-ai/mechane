import { CONTRACTS } from '@mechane/rules';

/** Workflow and local-action metadata discovered under the repository's GitHub directory. */
export const AUTOMATION_FILE = /^\.github\/(?:workflows\/[^/]+\.ya?ml|actions\/.+\/action\.ya?ml)$/;

/** Each budgeted document of the factory, by its path below the factory root, and the words it may hold. */
export const DOCUMENT_WORDS: Readonly<Record<string, number>> = {
  ...CONTRACTS['context-agent-instruction-files'].values.documentWords,
  ...CONTRACTS['docs-readme-structure'].values.documentWords,
};

/** Each document of the factory whose prose the documents check reads although no word budget bounds it. */
export const UNBUDGETED_DOCUMENTS: ReadonlyArray<string> = CONTRACTS['docs-prose-style'].values.unbudgetedDocuments;

/** A code span of prose, which reads as one word. */
export const CODE_SPAN = /`[^`]*`/g;
