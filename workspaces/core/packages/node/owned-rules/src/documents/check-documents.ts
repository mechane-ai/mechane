import { FACTORY_FOLDER, listFiles, readText, WORKSPACE_FOLDER } from '@mechane/checks-kernel';
import type { Finding, InputUnreadable, ReadInput, TextFile } from '@mechane/checks-kernel';
import { Array, Effect, Record } from 'effect';
import { join, relative, resolve } from 'node:path';
import { AUTOMATION_FILE, DOCUMENT_WORDS, UNBUDGETED_DOCUMENTS } from './constants.ts';
import { documentFindings } from './document-findings.ts';
import { workflowFindings } from './workflow-findings.ts';

const AUTOMATION_EXTENSIONS = ['.yml', '.yaml'] as const;

/** Reads a file of the factory by its path below the factory root. */
const readDocument = Effect.fn('readDocument')(function* ({
  path,
}: ReadInput): Effect.fn.Return<TextFile, InputUnreadable> {
  const text = yield* readText({ path: join(FACTORY_FOLDER, path) });

  return { path, text };
});

/**
 * Checks the factory's documents against their budgets and prose limits, the unbudgeted ones against their prose limits
 * alone, and its automation's pinned steps and permissions.
 */
export const checkDocuments = Effect.fn('checkDocuments')(function* (): Effect.fn.Return<
  ReadonlyArray<Finding>,
  InputUnreadable
> {
  const paths = [...Record.keys(DOCUMENT_WORDS), ...UNBUDGETED_DOCUMENTS];
  const documents = yield* Effect.forEach(paths, (path) => readDocument({ path }), { concurrency: 1 });

  const automationFolder = join(FACTORY_FOLDER, '.github');

  const folder = relative(WORKSPACE_FOLDER, automationFolder);

  const listings = yield* Effect.forEach(AUTOMATION_EXTENSIONS, (extension) => listFiles({ folder, extension }), {
    concurrency: 1,
  });

  const automation = Array.flatten(listings);

  const automationPaths = automation.map((path) => {
    const absolute = resolve(WORKSPACE_FOLDER, path);

    return relative(FACTORY_FOLDER, absolute);
  });

  const workflowPaths = automationPaths.filter((path) => AUTOMATION_FILE.test(path));
  const workflows = yield* Effect.forEach(workflowPaths, (path) => readDocument({ path }), { concurrency: 1 });

  return [...documentFindings({ files: documents }), ...workflows.flatMap((file) => workflowFindings(file))];
});
