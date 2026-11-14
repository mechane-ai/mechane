import { artifactDigest, readOptionalFile, sha256Hex } from '@mechane/program';
import { Array, Effect, Option, Record, Schema, Stream } from 'effect';
import { glob, readFile, realpath } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { EvalFileStep } from './constants.ts';
import { EvalFileFailed } from './errors.ts';

type EvalRunnerFingerprintInput = { readonly moduleUrl: URL; readonly binaryPath: Option.Option<string> };
type FindRunnerManifestInput = { readonly modulePath: string };
type ResolveRunnerManifestInput = { readonly specifier: string; readonly manifestPath: string };
type ReadManifestPageInput = { readonly folder: string };
type ManifestPage = readonly [ReadonlyArray<string>, Option.Option<string>];
type RunnerManifestPathInput = { readonly folder: string };
type RunnerPackage = { readonly name: string; readonly manifestPath: string; readonly folder: string };
type RunnerCursor = { readonly pending: ReadonlyArray<string>; readonly visited: ReadonlySet<string> };
type ReadRunnerPackageInput = { readonly cursor: RunnerCursor };
type RunnerPage = readonly [ReadonlyArray<RunnerPackage>, Option.Option<RunnerCursor>];
type RunnerPackageDigestsInput = { readonly entry: RunnerPackage };
type RunnerFileDigestInput = { readonly path: string; readonly reference: string };
type RunnerFileDigest = { readonly reference: string; readonly sha256: string };
type RunnerModuleNameInput = { readonly packageName: string; readonly name: string };

const WORKSPACE_PACKAGE_PREFIX = '@mechane/';

const RunnerManifest = Schema.StructWithRest(
  Schema.Struct({
    name: Schema.NonEmptyString,
    dependencies: Schema.OptionFromOptionalKey(Schema.Record(Schema.String, Schema.String)),
  }),
  [Schema.Record(Schema.String, Schema.Json)],
);

type RunnerManifest = typeof RunnerManifest.Type;

const RunnerManifestFile = Schema.fromJsonString(RunnerManifest);

/** Source invocations freeze package bytes; a standalone CLI freezes the executable that contains them. */
export const evalRunnerFingerprint = Effect.fn('evalRunnerFingerprint')(function* ({
  moduleUrl,
  binaryPath,
}: EvalRunnerFingerprintInput): Effect.fn.Return<string, EvalFileFailed> {
  if (Option.isSome(binaryPath)) {
    const digest = yield* runnerFileDigest({ path: binaryPath.value, reference: binaryPath.value });

    return digest.sha256;
  }

  const modulePath = yield* Effect.try({
    try: () => fileURLToPath(moduleUrl),
    catch: (cause) => new EvalFileFailed({ step: EvalFileStep.Read, path: moduleUrl.href, reason: String(cause) }),
  });

  const manifestPath = yield* findRunnerManifest({ modulePath });
  const cursor: RunnerCursor = { pending: [manifestPath], visited: new Set() };
  const pages = Stream.paginate(cursor, (current) => readRunnerPackage({ cursor: current }));
  const packages = yield* Stream.runCollect(pages);
  const files = yield* Effect.forEach(packages, (entry) => runnerPackageDigests({ entry }), { concurrency: 1 });

  const lines = files
    .flat()
    .map((file) => `${file.reference} ${file.sha256}`)
    .toSorted();

  const contents = lines.join('\n');

  return sha256Hex({ contents });
});

const findRunnerManifest = Effect.fn('findRunnerManifest')(function* ({
  modulePath,
}: FindRunnerManifestInput): Effect.fn.Return<string, EvalFileFailed> {
  const resolved = yield* Effect.tryPromise({
    try: () => realpath(modulePath),
    catch: (cause) => new EvalFileFailed({ step: EvalFileStep.Read, path: modulePath, reason: String(cause) }),
  });

  const folder = dirname(resolved);
  const pages = Stream.paginate(folder, (current) => readManifestPage({ folder: current }));
  const manifests = yield* Stream.runCollect(pages);
  const manifestPath = Array.head(manifests);

  if (Option.isNone(manifestPath)) {
    return yield* new EvalFileFailed({
      step: EvalFileStep.Read,
      path: modulePath,
      reason: 'runner package manifest is unavailable',
    });
  }

  return manifestPath.value;
});

const readManifestPage = Effect.fn('readManifestPage')(function* ({
  folder,
}: ReadManifestPageInput): Effect.fn.Return<ManifestPage, EvalFileFailed> {
  const path = runnerManifestPath({ folder });

  const file = yield* readOptionalFile({ path }).pipe(
    Effect.mapError((error) => new EvalFileFailed({ step: EvalFileStep.Read, path, reason: error.reason })),
  );

  if (Option.isSome(file)) {
    return [[path], Option.none()];
  }

  const parent = dirname(folder);

  if (parent === folder) {
    return [[], Option.none()];
  }

  return [[], Option.some(parent)];
});

const resolveRunnerManifest = Effect.fn('resolveRunnerManifest')(function* ({
  specifier,
  manifestPath,
}: ResolveRunnerManifestInput): Effect.fn.Return<string, EvalFileFailed> {
  const packageRequire = createRequire(manifestPath);

  const modulePath = yield* Effect.try({
    try: () => packageRequire.resolve(specifier),
    catch: (cause) => new EvalFileFailed({ step: EvalFileStep.Read, path: specifier, reason: String(cause) }),
  });

  return yield* findRunnerManifest({ modulePath });
});

const readRunnerPackage = Effect.fn('readRunnerPackage')(function* ({
  cursor,
}: ReadRunnerPackageInput): Effect.fn.Return<RunnerPage, EvalFileFailed> {
  const [first, ...remaining] = cursor.pending;
  const current = Option.fromUndefinedOr(first);

  if (Option.isNone(current)) {
    return [[], Option.none()];
  }

  const manifestPath = current.value;

  if (cursor.visited.has(manifestPath)) {
    return [[], Option.some({ pending: remaining, visited: cursor.visited })];
  }

  const text = yield* Effect.tryPromise({
    try: () => readFile(manifestPath, 'utf8'),
    catch: (cause) => new EvalFileFailed({ step: EvalFileStep.Read, path: manifestPath, reason: String(cause) }),
  });

  const manifest = yield* Schema.decodeUnknownEffect(RunnerManifestFile, { onExcessProperty: 'error' })(text).pipe(
    Effect.mapError(
      (error) => new EvalFileFailed({ step: EvalFileStep.Decode, path: manifestPath, reason: error.message }),
    ),
  );

  const dependencies = Option.getOrElse(manifest.dependencies, () => Record.empty<string, string>());
  const dependencyNames = Record.keys(dependencies).filter((name) => name.startsWith(WORKSPACE_PACKAGE_PREFIX));

  const dependencyPaths = yield* Effect.forEach(
    dependencyNames,
    (specifier) => resolveRunnerManifest({ specifier, manifestPath }),
    { concurrency: 1 },
  );

  const visited = new Set([...cursor.visited, manifestPath]);
  const next: RunnerCursor = { pending: [...remaining, ...dependencyPaths], visited };
  const entry: RunnerPackage = { name: manifest.name, manifestPath, folder: dirname(manifestPath) };

  return [[entry], Option.some(next)];
});

const runnerPackageDigests = Effect.fn('runnerPackageDigests')(function* ({
  entry,
}: RunnerPackageDigestsInput): Effect.fn.Return<ReadonlyArray<RunnerFileDigest>, EvalFileFailed> {
  const patterns = runnerModuleGlobs();

  const matching = glob(patterns, {
    cwd: entry.folder,
    exclude: ['**/node_modules/**', '**/trials/**', '**/audits/**'],
    followSymlinks: false,
  });

  const paths = Stream.fromAsyncIterable(matching, (cause) => {
    const reason = String(cause);

    return new EvalFileFailed({ step: EvalFileStep.Read, path: entry.folder, reason });
  });

  const names = yield* Stream.runCollect(paths);
  const manifestReference = runnerModuleName({ packageName: entry.name, name: 'package.json' });
  const manifest = yield* runnerFileDigest({ path: entry.manifestPath, reference: manifestReference });
  const sortedNames = names.toSorted();

  const modules = yield* Effect.forEach(
    sortedNames,
    (name) => {
      const path = join(entry.folder, name);
      const reference = runnerModuleName({ packageName: entry.name, name });

      return runnerFileDigest({ path, reference });
    },
    { concurrency: 1 },
  );

  return [manifest, ...modules];
});

const runnerFileDigest = Effect.fn('runnerFileDigest')(function* ({
  path,
  reference,
}: RunnerFileDigestInput): Effect.fn.Return<RunnerFileDigest, EvalFileFailed> {
  const digest = yield* artifactDigest({ path }).pipe(
    Effect.mapError((error) => new EvalFileFailed({ step: EvalFileStep.Read, path, reason: error.reason })),
  );

  return { reference, sha256: digest.sha256 };
});

function runnerModuleGlobs(): ReadonlyArray<string> {
  return ['src/**/*.{ts,tsx,js,jsx,mjs,cjs}', 'dist/**/*.{js,mjs,cjs}'];
}

function runnerManifestPath({ folder }: RunnerManifestPathInput): string {
  return join(folder, 'package.json');
}

function runnerModuleName({ packageName, name }: RunnerModuleNameInput): string {
  return `${packageName}:${name}`;
}
