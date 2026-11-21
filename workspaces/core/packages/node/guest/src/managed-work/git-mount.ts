import type { BetaManagedAgentsGitHubRepositoryResource } from '@anthropic-ai/sdk/resources/beta/sessions/resources';
import { BYTES_PER_KIBIBYTE } from '@mechane/records';
import { Effect, Option, Predicate, Schema } from 'effect';
import type { Scope } from 'effect';
import { execFile } from 'node:child_process';
import { lstatSync } from 'node:fs';
import type { Stats } from 'node:fs';
import { mkdir, readFile, realpath, rename, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { promisify } from 'node:util';
import { acquireStagedDirectory } from './mount-stage.ts';

const git = promisify(execFile);
const METADATA = '.git';
const MARKER = 'mechane-resource';
const BRANCH = 'branch';
const COMMIT = 'commit';
const GIT_EXECUTABLE = '/usr/bin/git';
const EMPTY_CONFIGURATION = '/dev/null';
const LOCAL_ORIGIN = 'http:';
const LOOPBACK = '127.0.0.1';
const HEADS = 'refs/heads';
const WORKSPACE = 'workspace';
const MARKER_MAX_BYTES = BYTES_PER_KIBIBYTE;
const RESERVED_SEGMENTS: ReadonlySet<string> = new Set(['', '.', '..', METADATA]);

type GitIdentity = { readonly commitAuthorName: string; readonly commitAuthorEmail: string };

type MountInput = {
  readonly resource: BetaManagedAgentsGitHubRepositoryResource;
  readonly workspace: string;
  readonly remote: URL;
  readonly signal: AbortSignal;
  readonly identity: GitIdentity;
};

type MountCommand = { readonly args: ReadonlyArray<string>; readonly signal: AbortSignal };
type FilePath = { readonly path: string };
type MountLocation = Pick<MountInput, 'workspace'> & FilePath;
type MountedRepository = Pick<MountInput, 'identity' | 'remote' | 'signal'> & { readonly target: string };
type RemoteSetting = Pick<MountInput, 'remote'> & { readonly value: string };
type PinnedCommit = Pick<MountInput, 'signal'> & { readonly stage: string; readonly sha: string };
type WriteIdentity = Pick<MountInput, 'identity' | 'signal'> & { readonly configuration: string };

export class GitMountFailed extends Schema.TaggedError<GitMountFailed>()('GitMountFailed', { reason: Schema.String }) {
  override get message(): string {
    return this.reason;
  }
}

const gitCommand = Effect.fn('gitCommand')(function* ({
  args,
  signal,
}: MountCommand): Effect.fn.Return<string, GitMountFailed> {
  // Ignore session-controlled executables and Git configuration during mount preparation.
  const argumentsList = ['-c', 'core.hooksPath=/dev/null', '-c', 'credential.helper=', ...args];

  const childEnvironment = {
    PATH: '/usr/bin:/bin',
    GIT_CONFIG_NOSYSTEM: '1',
    GIT_CONFIG_GLOBAL: EMPTY_CONFIGURATION,
    GIT_TERMINAL_PROMPT: '0',
    NO_PROXY: LOOPBACK,
  };

  const result = yield* Effect.tryPromise({
    try: () => git(GIT_EXECUTABLE, argumentsList, { cwd: '/', env: childEnvironment, signal }),
    catch: (cause) => new GitMountFailed({ reason: String(cause) }),
  });

  return result.stdout.trimEnd();
});

const inspectPath = Effect.fn('inspectPath')(function* ({
  path,
}: FilePath): Effect.fn.Return<Option.Option<Stats>, GitMountFailed> {
  const details = yield* Effect.try({
    try: () => lstatSync(path, { throwIfNoEntry: false }),
    catch: (cause) => new GitMountFailed({ reason: String(cause) }),
  });

  return Option.fromNullishOr(details);
});

const mountDirectory = Effect.fn('mountDirectory')(function* ({
  workspace,
  path,
}: MountLocation): Effect.fn.Return<string, GitMountFailed> {
  const [root, prefix, ...segments] = path.split('/');

  const segmentsAreSafe = segments.every((part) => {
    const normalized = part.toLowerCase();
    const characters = Array.from(part);

    return (
      !RESERVED_SEGMENTS.has(normalized) && !part.includes('\\') && characters.every((character) => character >= ' ')
    );
  });

  const startsInWorkspace = root === '' && prefix === WORKSPACE;

  if (!startsInWorkspace || segments.length === 0 || !segmentsAreSafe) {
    return yield* new GitMountFailed({ reason: 'Invalid Git resource mount' });
  }

  const destination = yield* Effect.tryPromise({
    try: () => realpath(workspace),
    catch: (cause) => new GitMountFailed({ reason: String(cause) }),
  });

  const ancestors = segments.slice(0, -1);

  for (const index of ancestors.keys()) {
    const parts = ancestors.slice(0, index + 1);
    const directory = join(destination, ...parts);
    const details = yield* inspectPath({ path: directory });

    if (Option.isNone(details)) {
      yield* Effect.tryPromise({
        try: () => mkdir(directory),
        catch: (cause) => new GitMountFailed({ reason: String(cause) }),
      });
    } else if (!details.value.isDirectory()) {
      return yield* new GitMountFailed({ reason: 'Git mount parent must be a real directory' });
    }
  }

  return join(destination, ...segments);
});

function sameMount({ value, remote }: RemoteSetting): boolean {
  if (!URL.canParse(value)) {
    return false;
  }

  const existing = new URL(value);

  const local = existing.protocol === LOCAL_ORIGIN && existing.hostname === LOOPBACK;
  const hasCredentials = existing.username !== '' || existing.password !== '';
  const barePath = existing.search === '' && existing.hash === '' && existing.pathname === remote.pathname;

  return local && !hasCredentials && barePath;
}

const writeIdentity = Effect.fn('writeIdentity')(function* ({
  configuration,
  identity,
  signal,
}: WriteIdentity): Effect.fn.Return<void, GitMountFailed> {
  const args = ['config', '--no-includes', '--file', configuration, '--replace-all', '--'];

  yield* gitCommand({ args: [...args, 'user.name', identity.commitAuthorName], signal });
  yield* gitCommand({ args: [...args, 'user.email', identity.commitAuthorEmail], signal });
});

const reopen = Effect.fn('reopen')(function* ({
  identity,
  remote,
  signal,
  target,
}: MountedRepository): Effect.fn.Return<void, GitMountFailed> {
  const metadata = join(target, METADATA);
  const configuration = join(metadata, 'config');
  const marker = join(metadata, MARKER);

  for (const directory of [target, metadata]) {
    const details = yield* inspectPath({ path: directory });

    if (Option.isNone(details) || !details.value.isDirectory()) {
      return yield* new GitMountFailed({ reason: 'Git resource mount is already occupied' });
    }
  }

  for (const file of [marker, configuration]) {
    const details = yield* inspectPath({ path: file });

    if (Option.isNone(details) || !details.value.isFile()) {
      return yield* new GitMountFailed({ reason: 'Git resource metadata is unsafe' });
    }

    if (file === marker && details.value.size > MARKER_MAX_BYTES) {
      return yield* new GitMountFailed({ reason: 'Invalid Git mount marker' });
    }
  }

  const retainedRoute = yield* Effect.tryPromise({
    try: () => readFile(marker, 'utf8'),
    catch: (cause) => new GitMountFailed({ reason: String(cause) }),
  });

  if (retainedRoute !== remote.pathname) {
    return yield* new GitMountFailed({ reason: 'Git resource belongs to another mount' });
  }

  const configurationArgs = ['config', '--no-includes', '--file', configuration];
  // Listing all values distinguishes a user-deleted origin from a failed configuration read.
  const settings = yield* gitCommand({ args: [...configurationArgs, '--null', '--list'], signal });
  const entries = settings.split('\0');
  const key = 'remote.origin.url\n';
  const origins = entries.filter((entry) => entry.startsWith(key));
  const [first] = origins;

  if (origins.length === 1 && Predicate.isString(first)) {
    const value = first.slice(key.length);

    if (sameMount({ value, remote })) {
      yield* gitCommand({ args: [...configurationArgs, 'remote.origin.url', remote.href], signal });
    }
  }

  yield* writeIdentity({ configuration, identity, signal });
});

const checkoutCommit = Effect.fn('checkoutCommit')(function* ({
  stage,
  sha,
  signal,
}: PinnedCommit): Effect.fn.Return<void, GitMountFailed> {
  if (!/^[0-9a-f]{7,64}$/iu.test(sha)) {
    return yield* new GitMountFailed({ reason: 'Invalid Git resource commit' });
  }

  const prefix = sha.toLowerCase();
  const args = ['-C', stage];
  const matches = yield* gitCommand({ args: [...args, 'rev-parse', `--disambiguate=${prefix}`], signal });

  // One complete object ID excludes ambiguous results and refs named after a hexadecimal prefix.
  if (!/^(?:[0-9a-f]{40}|[0-9a-f]{64})$/u.test(matches) || !matches.startsWith(prefix)) {
    return yield* new GitMountFailed({ reason: 'Git resource commit did not resolve to a unique object' });
  }

  const objectType = yield* gitCommand({ args: [...args, 'cat-file', '-t', matches], signal });

  if (objectType !== COMMIT) {
    return yield* new GitMountFailed({ reason: 'Git resource object is not a commit' });
  }

  yield* gitCommand({ args: [...args, 'checkout', '--detach', matches], signal });

  const head = yield* gitCommand({ args: [...args, 'rev-parse', 'HEAD'], signal });

  if (head !== matches) {
    return yield* new GitMountFailed({ reason: 'Git resource commit was not checked out' });
  }
});

export const mountGitRepository = Effect.fn('mountGitRepository')(function* ({
  workspace,
  resource,
  identity,
  remote,
  signal,
}: MountInput): Effect.fn.Return<void, GitMountFailed, Scope.Scope> {
  const target = yield* mountDirectory({ workspace, path: resource.mount_path });
  const existing = yield* inspectPath({ path: target });

  if (Option.isSome(existing)) {
    return yield* reopen({ identity, remote, signal, target });
  }

  const parent = dirname(target);
  const staged = acquireStagedDirectory({ parent, prefix: '.mechane-git-' });

  const stage = yield* Effect.mapError(staged, (cause) => new GitMountFailed({ reason: cause.reason }));

  const checkout = Option.fromNullishOr(resource.checkout);
  const clone = ['clone', '--no-local', '--no-recurse-submodules', '--template='];

  if (Option.isSome(checkout) && checkout.value.type === BRANCH) {
    clone.push('--branch', checkout.value.name);
  }

  yield* gitCommand({ args: [...clone, '--', remote.href, stage], signal });

  if (Option.isSome(checkout) && checkout.value.type === BRANCH) {
    const head = yield* gitCommand({ args: ['-C', stage, 'symbolic-ref', 'HEAD'], signal });
    const expected = [HEADS, checkout.value.name].join('/');

    if (head !== expected) {
      return yield* new GitMountFailed({ reason: 'Git branch was not checked out' });
    }
  }

  if (Option.isSome(checkout) && checkout.value.type === COMMIT) {
    yield* checkoutCommit({ stage, sha: checkout.value.sha, signal });
  }

  const configuration = join(stage, METADATA, 'config');

  yield* writeIdentity({ configuration, identity, signal });

  const marker = join(stage, METADATA, MARKER);

  yield* Effect.tryPromise({
    try: () => writeFile(marker, remote.pathname, { flag: 'wx', mode: 0o600 }),
    catch: (cause) => new GitMountFailed({ reason: String(cause) }),
  });
  yield* Effect.tryPromise({
    try: () => rename(stage, target),
    catch: (cause) => new GitMountFailed({ reason: String(cause) }),
  });
}, Effect.scoped);
