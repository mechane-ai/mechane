import type { ProcessFailed } from '@mechane/program';
import { finishedProcess } from '@mechane/program';
import type { Stack } from '@mechane/stack';
import { FileStep, FileStepFailed, freshFolder } from '@mechane/testing';
import type { ScenarioFailure } from '@mechane/testing';
import { Duration, Effect } from 'effect';
import { randomBytes } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { HOME_VARIABLE, RepositoryPart } from './constants.ts';
import type { StackInput } from './types.ts';

/** How many random bytes tell the README's one line from any other text. */
const README_LINE_BYTES = 8;

/**
 * The variables the fixture's git runs with beside the stack's and a home of its own: no system configuration, and a
 * fixed identity for its one commit.
 */
const FIXTURE_GIT_VARIABLES = {
  GIT_CONFIG_NOSYSTEM: '1',
  GIT_AUTHOR_NAME: 'smoke',
  GIT_AUTHOR_EMAIL: 'smoke@localhost',
  GIT_COMMITTER_NAME: 'smoke',
  GIT_COMMITTER_EMAIL: 'smoke@localhost',
} as const;

/** How long one of the fixture's git commands may run. */
const FIXTURE_GIT_TIMEOUT = Duration.seconds(30);

/** The scenario's repository: the `file://` URL of its bare copy, and the one line its README holds. */
type ReadmeRepository = { readonly url: string; readonly line: string };

type FixtureGitInput = { readonly stack: Stack; readonly home: string; readonly args: ReadonlyArray<string> };

/**
 * A bare repository at a `file://` URL in the stack's state folder, whose one commit holds a README of one random line.
 * Only a clone of it can print that line.
 */
export const readmeRepository = Effect.fn('readmeRepository')(function* ({
  stack,
}: StackInput): Effect.fn.Return<ReadmeRepository, ScenarioFailure> {
  const line = `a line of ${randomBytes(README_LINE_BYTES).toString('hex')}`;
  const home = yield* freshFolder({ stack, prefix: RepositoryPart.Prefix });
  const work = join(home, RepositoryPart.Work);
  const readme = join(work, RepositoryPart.Readme);
  const bare = join(home, RepositoryPart.Bare);
  const text = `${line}\n`;

  yield* Effect.tryPromise({
    try: () => mkdir(work),
    catch: (cause) => new FileStepFailed({ step: FileStep.Create, path: work, reason: String(cause) }),
  });
  yield* Effect.tryPromise({
    try: () => writeFile(readme, text),
    catch: (cause) => new FileStepFailed({ step: FileStep.Write, path: readme, reason: String(cause) }),
  });
  yield* fixtureGit({ stack, home, args: ['init', '--quiet', work] });
  yield* fixtureGit({ stack, home, args: ['-C', work, 'add', RepositoryPart.Readme] });
  yield* fixtureGit({ stack, home, args: ['-C', work, 'commit', '--quiet', '--message', 'Add the README'] });
  yield* fixtureGit({ stack, home, args: ['clone', '--quiet', '--bare', '--', work, bare] });

  return { url: pathToFileURL(bare).href, line };
});

/** Runs git for the fixture with the stack's variables in a home of its own, and fails unless it exits with success. */
const fixtureGit = Effect.fn('fixtureGit')(function* ({
  stack,
  home,
  args,
}: FixtureGitInput): Effect.fn.Return<void, ProcessFailed> {
  const environment = { ...stack.settings.inherited, [HOME_VARIABLE]: home, ...FIXTURE_GIT_VARIABLES };

  yield* finishedProcess({ command: 'git', args, environment, timeout: FIXTURE_GIT_TIMEOUT });
});
