import { ArtifactDigest, artifactDigest, StepSubjects } from '@mechane/program';
import { PagePath } from '@mechane/protocol';
import { MediaType } from '@mechane/records';
import { Effect, Option, Schema } from 'effect';
import { createHash } from 'node:crypto';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CONSOLE_BUNDLE } from './constants.ts';
import { readJsonc } from './read-jsonc.ts';

const CLIENT_URL: Readonly<URL> = new URL('../../../browser/console/dist/client/', import.meta.url);
const CLIENT_FOLDER = fileURLToPath(CLIENT_URL);
const CONSOLE_PATH = /^\/console\/[A-Za-z0-9_/-]+\.[A-Za-z0-9]+$/;
const INDEX_PATH = '/console/index.html';
const ENTRANCE_PATHS = [INDEX_PATH, '/console/welcome.html'] as const;

const CONSOLE_TYPES: Readonly<Record<string, MediaType>> = {
  '.html': MediaType.Html,
  '.js': MediaType.JavaScript,
  '.css': MediaType.Css,
  '.svg': MediaType.Svg,
  '.png': MediaType.Png,
  '.ico': MediaType.Icon,
  '.woff2': MediaType.Woff2,
  '.txt': MediaType.Utf8PlainText,
};

const ConsoleStep = {
  Build: 'build console assets',
  Read: 'read console assets',
  Stage: 'stage console assets',
} as const;

/** The complete console inventory, including exact bytes and per-file digests. */
export const ConsoleBundle = Schema.Struct({
  files: Schema.Array(
    Schema.Struct({
      path: Schema.String.check(Schema.isPattern(CONSOLE_PATH)),
      content_type: Schema.Enum(MediaType),
      content_base64: Schema.String,
      ...ArtifactDigest.fields,
    }),
  ),
});

export type ConsoleBundle = typeof ConsoleBundle.Type;
type ConsoleFile = ConsoleBundle['files'][number];
type ConsoleFileInput = { readonly path: string };
type ConsoleBundleInput = ConsoleFileInput & { readonly expected: ArtifactDigest };
type StageConsoleInput = ConsoleBundleInput & { readonly folder: string };

class ConsoleBuildFailed extends Schema.TaggedError<ConsoleBuildFailed>()('ConsoleBuildFailed', {
  step: Schema.Enum(ConsoleStep),
  subjects: StepSubjects,
  reason: Schema.String,
}) {}

function consoleAssetPath({ path }: ConsoleFileInput): string {
  return `${PagePath.Console}/${path}`;
}

const readConsoleFile = Effect.fn('readConsoleFile')(function* ({
  path,
}: ConsoleFileInput): Effect.fn.Return<ConsoleFile, ConsoleBuildFailed> {
  const extension = extname(path);
  const contentType = Option.fromNullishOr(CONSOLE_TYPES[extension]);

  if (Option.isNone(contentType)) {
    return yield* new ConsoleBuildFailed({ step: ConsoleStep.Build, reason: `Unsupported console asset: ${path}` });
  }

  const bytes = yield* Effect.tryPromise({
    try: () => readFile(path),
    catch: (cause) => new ConsoleBuildFailed({ step: ConsoleStep.Build, reason: String(cause) }),
  });

  const relative = path.slice(CLIENT_FOLDER.length);
  const assetPath = consoleAssetPath({ path: relative });
  const content = bytes.toString('base64');
  const sha256 = createHash('sha256').update(bytes).digest('hex');

  return { path: assetPath, content_type: contentType.value, content_base64: content, sha256, bytes: bytes.byteLength };
});

/** Packages the production browser build into the release asset inventory. */
export const writeConsoleBundle = Effect.fn('writeConsoleBundle')(function* (): Effect.fn.Return<
  void,
  ConsoleBuildFailed
> {
  const names = yield* Effect.tryPromise({
    try: () => readdir(CLIENT_FOLDER, { recursive: true, withFileTypes: true }),
    catch: (cause) => new ConsoleBuildFailed({ step: ConsoleStep.Build, reason: String(cause) }),
  });

  const paths = names
    .filter((entry) => entry.isFile())
    .map((entry) => join(entry.parentPath, entry.name))
    .toSorted();

  const files = yield* Effect.forEach(paths, (path) => readConsoleFile({ path }), { concurrency: 1 });

  if (!ENTRANCE_PATHS.every((path) => files.some((file) => file.path === path))) {
    return yield* new ConsoleBuildFailed({
      step: ConsoleStep.Build,
      reason: 'The console build is missing an entry document',
    });
  }

  const value = Schema.encodeSync(ConsoleBundle)({ files });
  const json = JSON.stringify(value);

  yield* Effect.tryPromise({
    try: () => writeFile(CONSOLE_BUNDLE, json),
    catch: (cause) => new ConsoleBuildFailed({ step: ConsoleStep.Build, reason: String(cause) }),
  });
});

type ConsoleContentInput = { readonly file: ConsoleFile };

function hasValidContent({ file }: ConsoleContentInput): boolean {
  const bytes = Buffer.from(file.content_base64, 'base64');
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  const extension = extname(file.path);

  const matchesBytes = bytes.toString('base64') === file.content_base64 && bytes.byteLength === file.bytes;
  const matchesMetadata = sha256 === file.sha256 && CONSOLE_TYPES[extension] === file.content_type;

  return matchesBytes && matchesMetadata;
}

const readConsoleBundle = Effect.fn('readConsoleBundle')(function* ({
  path,
  expected,
}: ConsoleBundleInput): Effect.fn.Return<ConsoleBundle, ConsoleBuildFailed> {
  const actual = yield* artifactDigest({ path }).pipe(
    Effect.mapError((failure) => new ConsoleBuildFailed({ step: ConsoleStep.Read, reason: failure.reason })),
  );

  if (actual.sha256 !== expected.sha256 || actual.bytes !== expected.bytes) {
    return yield* new ConsoleBuildFailed({
      step: ConsoleStep.Read,
      reason: 'Console assets differ from the release manifest',
    });
  }

  const bundle = yield* readJsonc({
    path,
    schema: ConsoleBundle,
    options: { onExcessProperty: 'error' },
    step: ConsoleStep.Read,
    failure: ConsoleBuildFailed,
  });

  const paths = bundle.files.map((file) => file.path);
  const distinct: ReadonlySet<string> = new Set(paths);

  if (distinct.size !== paths.length || !bundle.files.every((file) => hasValidContent({ file }))) {
    return yield* new ConsoleBuildFailed({
      step: ConsoleStep.Read,
      reason: 'Console assets contain a duplicate path or mismatched content digest',
    });
  }

  if (!distinct.has(INDEX_PATH)) {
    return yield* new ConsoleBuildFailed({ step: ConsoleStep.Read, reason: 'Console assets have no index.html' });
  }

  return bundle;
});

/** Verifies the release inventory before materializing assets for the local Worker. */
export const stageConsole = Effect.fn('stageConsole')(function* ({
  path,
  expected,
  folder,
}: StageConsoleInput): Effect.fn.Return<void, ConsoleBuildFailed> {
  const bundle = yield* readConsoleBundle({ path, expected });

  for (const file of bundle.files) {
    const relative = file.path.slice(1);
    const target = join(folder, relative);
    const parent = dirname(target);
    const contents = Buffer.from(file.content_base64, 'base64');

    yield* Effect.tryPromise({
      try: () => mkdir(parent, { recursive: true }),
      catch: (cause) => new ConsoleBuildFailed({ step: ConsoleStep.Stage, reason: String(cause) }),
    });
    yield* Effect.tryPromise({
      try: () => writeFile(target, contents),
      catch: (cause) => new ConsoleBuildFailed({ step: ConsoleStep.Stage, reason: String(cause) }),
    });
  }
});
