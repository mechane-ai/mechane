import { BYTES_PER_MEBIBYTE, EvidenceProvenance, GitCommit } from '@mechane/records';
import { Duration, Effect, Option, Result, Schema } from 'effect';
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { realpath } from 'node:fs/promises';
import { isAbsolute, relative, resolve, sep } from 'node:path';
import { BrowserFailureKind } from './errors.ts';

const GIT_OUTPUT_MAX_BYTES = 4 * BYTES_PER_MEBIBYTE;
const GIT_TIMEOUT = Duration.seconds(10);
const PARENT_DIRECTORY = '..';

class BrowserProvenanceUnavailable extends Schema.TaggedError<BrowserProvenanceUnavailable>()(
  'BrowserProvenanceUnavailable',
  { kind: Schema.Enum(BrowserFailureKind), reason: Schema.String },
) {}

type BrowserProvenanceInput = {
  readonly home: string;
  /** Absent when no local checkout was selected; provenance remains explicitly unknown. */
  readonly repositoryPath: Option.Option<string>;
  readonly path: string;
};

/** The caller supplies a checkout to inspect; it cannot supply the observed revision. */
export const readBrowserProvenance = Effect.fn('readBrowserProvenance')(function* (
  input: BrowserProvenanceInput,
): Effect.fn.Return<EvidenceProvenance> {
  if (Option.isNone(input.repositoryPath)) {
    return EvidenceProvenance.cases.Unknown.make({ reason: 'No checkout was selected for this capture' });
  }

  const requestedPath = input.repositoryPath.value;

  return yield* observeBrowserCheckout({ ...input, requestedPath }).pipe(
    Effect.catchTags({
      BrowserProvenanceUnavailable: ({ reason }) => {
        const unknown = EvidenceProvenance.cases.Unknown.make({ reason });

        return Effect.succeed(unknown);
      },
    }),
  );
});

type ObserveCheckoutInput = Omit<BrowserProvenanceInput, 'repositoryPath'> & { readonly requestedPath: string };

const observeBrowserCheckout = Effect.fn('observeBrowserCheckout')(function* ({
  home,
  requestedPath,
  path,
}: ObserveCheckoutInput): Effect.fn.Return<EvidenceProvenance, BrowserProvenanceUnavailable> {
  const resolvedHome = yield* resolveBrowserDirectory({ path: home });
  const requested = resolve(resolvedHome, requestedPath);
  const directory = yield* resolveBrowserDirectory({ path: requested });

  if (!isInsideWorkspace({ home: resolvedHome, path: directory })) {
    return yield* new BrowserProvenanceUnavailable({
      kind: BrowserFailureKind.Target,
      reason: 'The selected checkout is outside the workspace',
    });
  }

  const environment = {
    PATH: path,
    HOME: resolvedHome,
    LANG: 'C.UTF-8',
    GIT_CONFIG_NOSYSTEM: '1',
    GIT_CONFIG_GLOBAL: '/dev/null',
    GIT_TERMINAL_PROMPT: '0',
    GIT_OPTIONAL_LOCKS: '0',
  };

  const read = Effect.fn('read')(function* ({
    args,
  }: GitArguments): Effect.fn.Return<Buffer, BrowserProvenanceUnavailable> {
    return yield* readBrowserGit({ directory, environment, args });
  });

  const root = yield* read({ args: ['rev-parse', '--show-toplevel'] });
  const rootPath = root.toString('utf8').trim();
  const repository = yield* resolveBrowserDirectory({ path: rootPath });
  const gitLocation = yield* read({ args: ['rev-parse', '--absolute-git-dir'] });
  const gitPath = gitLocation.toString('utf8').trim();
  const gitDirectory = yield* resolveBrowserDirectory({ path: gitPath });

  if (
    !isInsideWorkspace({ home: resolvedHome, path: repository }) ||
    !isInsideWorkspace({ home: resolvedHome, path: gitDirectory })
  ) {
    return yield* new BrowserProvenanceUnavailable({
      kind: BrowserFailureKind.Target,
      reason: 'The selected Git checkout is outside the workspace',
    });
  }

  const revision = yield* read({ args: ['rev-parse', '--verify', 'HEAD'] });
  const headText = revision.toString('utf8').trim();

  const head = yield* Schema.decodeUnknownEffect(GitCommit)(headText).pipe(
    Effect.mapError(
      () =>
        new BrowserProvenanceUnavailable({
          kind: BrowserFailureKind.Target,
          reason: 'The checkout has no supported Git revision',
        }),
    ),
  );

  const status = yield* read({
    args: ['status', '--porcelain=v1', '-z', '--untracked-files=normal', '--ignore-submodules=none'],
  });

  const isDirty = status.byteLength > 0;
  const entries = status.toString('utf8').split('\0');
  const hasUntracked = entries.some((entry) => entry.startsWith('?? '));

  const readDirtyPatch = Effect.fn('readDirtyPatch')(function* (): Effect.fn.Return<
    Option.Option<string>,
    BrowserProvenanceUnavailable
  > {
    if (!isDirty || hasUntracked) {
      return Option.none();
    }

    const patch = yield* read({
      args: ['diff', '--binary', '--no-ext-diff', '--no-textconv', '--ignore-submodules=none', 'HEAD', '--'],
    });

    const digest = createHash('sha256').update(patch).digest('hex');

    return Option.some(digest);
  });

  const dirtyPatchSha256 = yield* readDirtyPatch();

  return EvidenceProvenance.cases.ObservedGit.make({ repositoryPath: repository, head, isDirty, dirtyPatchSha256 });
});

type DirectoryInput = { readonly path: string };

const resolveBrowserDirectory = Effect.fn('resolveBrowserDirectory')(function* ({
  path,
}: DirectoryInput): Effect.fn.Return<string, BrowserProvenanceUnavailable> {
  return yield* Effect.tryPromise({
    try: () => realpath(path),
    catch: () =>
      new BrowserProvenanceUnavailable({
        kind: BrowserFailureKind.Target,
        reason: 'The selected checkout directory is unavailable',
      }),
  });
});

type InsideWorkspaceInput = DirectoryInput & { readonly home: string };

function isInsideWorkspace({ home, path }: InsideWorkspaceInput): boolean {
  const suffix = relative(home, path);

  return suffix !== PARENT_DIRECTORY && !suffix.startsWith(`${PARENT_DIRECTORY}${sep}`) && !isAbsolute(suffix);
}

type GitArguments = { readonly args: ReadonlyArray<string> };

type ReadBrowserGitInput = GitArguments & {
  readonly directory: string;
  readonly environment: Readonly<Record<string, string>>;
};

const readBrowserGit = Effect.fn('readBrowserGit')(function* ({
  directory,
  environment,
  args,
}: ReadBrowserGitInput): Effect.fn.Return<Buffer, BrowserProvenanceUnavailable> {
  return yield* Effect.callback<Buffer, BrowserProvenanceUnavailable>((resume) => {
    const commandArgs = ['--no-pager', '-c', 'core.fsmonitor=false', '-C', directory, ...args];
    const timeout = Duration.toMillis(GIT_TIMEOUT);

    const child = execFile(
      'git',
      commandArgs,
      { env: environment, encoding: 'buffer', timeout, maxBuffer: GIT_OUTPUT_MAX_BYTES },
      (error, output) => {
        const failure = Option.fromNullishOr(error);

        if (Option.isSome(failure)) {
          const unavailable = new BrowserProvenanceUnavailable({
            kind: BrowserFailureKind.Process,
            reason: 'Git provenance was unavailable within its output or time limit',
          });

          const rejected = Result.fail(unavailable);
          const failed = Effect.fromResult(rejected);

          resume(failed);

          return;
        }

        const accepted = Result.succeed(output);
        const success = Effect.fromResult(accepted);

        resume(success);
      },
    );

    return Effect.sync(() => {
      child.kill('SIGKILL');
    });
  });
});
