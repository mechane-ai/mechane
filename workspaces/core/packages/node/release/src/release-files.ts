import { StepSubject } from '@mechane/program';
import { ManifestKey, ReleaseKey } from '@mechane/protocol';
import { Effect, Schema } from 'effect';
import { readdir } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { ReleaseStep } from './constants.ts';
import { ReleaseFailed } from './errors.ts';

type FolderInput = { readonly folder: string };

/** One file of a built release: its bucket key, and where the release's folder holds it. */
type ReleaseFile = { readonly key: string; readonly path: string };

/**
 * The files of built releases below `folder`, each keyed by its path below it, in the order a publish writes them. Each
 * release's binaries come before its manifest, and `cli/latest.json` comes last. So a published manifest means its
 * binaries are, and a publish that stops midway leaves the latest release as it was.
 */
export const releaseFiles = Effect.fn('releaseFiles')(function* ({
  folder,
}: FolderInput): Effect.fn.Return<ReadonlyArray<ReleaseFile>, ReleaseFailed> {
  const subjects = [StepSubject.cases.Path.make({ path: folder })];

  const entries = yield* Effect.tryPromise({
    try: () => readdir(folder, { recursive: true, withFileTypes: true }),
    catch: (cause) => new ReleaseFailed({ step: ReleaseStep.ListFiles, subjects, reason: String(cause) }),
  });

  const isManifest = Schema.is(ManifestKey);
  const releaseFile: (path: string) => ReleaseFile = (path) => ({ key: relative(folder, path), path });

  const files = entries
    .filter((entry) => entry.isFile())
    .map((entry) => join(entry.parentPath, entry.name))
    .map(releaseFile);

  const isBinary: (file: ReleaseFile) => boolean = ({ key }) => key !== ReleaseKey.Latest && !isManifest(key);

  return [
    ...files.filter(isBinary),
    ...files.filter(({ key }) => isManifest(key)),
    ...files.filter(({ key }) => key === ReleaseKey.Latest),
  ];
});
