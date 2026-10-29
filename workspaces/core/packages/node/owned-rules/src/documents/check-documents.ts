import { FACTORY_FOLDER, readText } from '@mechane/checks-kernel';
import type { Finding, InputUnreadable, ReadInput, TextFile } from '@mechane/checks-kernel';
import { Effect, Record } from 'effect';
import { join } from 'node:path';
import { DOCUMENT_WORDS, UNBUDGETED_DOCUMENTS, WORKFLOWS } from './constants.ts';
import { documentFindings } from './document-findings.ts';
import { workflowFindings } from './workflow-findings.ts';

/** Reads a file of the factory by its path below the factory root. */
const readDocument = Effect.fn('readDocument')(function* ({
  path,
}: ReadInput): Effect.fn.Return<TextFile, InputUnreadable> {
  const text = yield* readText({ path: join(FACTORY_FOLDER, path) });

  return { path, text };
});

/**
 * Checks the factory's documents against their budgets and prose limits, the unbudgeted ones against their prose limits
 * alone, and its workflows' pins.
 */
export const checkDocuments = Effect.fn('checkDocuments')(function* (): Effect.fn.Return<
  ReadonlyArray<Finding>,
  InputUnreadable
> {
  const paths = [...Record.keys(DOCUMENT_WORDS), ...UNBUDGETED_DOCUMENTS];
  const documents = yield* Effect.forEach(paths, (path) => readDocument({ path }), { concurrency: 1 });
  const workflows = yield* Effect.forEach(WORKFLOWS, (path) => readDocument({ path }), { concurrency: 1 });

  return [...documentFindings({ files: documents }), ...workflows.flatMap((file) => workflowFindings(file))];
});
