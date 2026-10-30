import { RELEASE } from '@mechane/protocol';
import { GitCommit } from '@mechane/records';
import { Effect, Schema } from 'effect';
import { DistributionStep, SOURCE_FOLDER } from '../constants.ts';
import { DistributionFailed } from '../errors.ts';
import { runCommand } from '../files/run-command.ts';
import type { DistributionInput } from '../types.ts';

const PUBLIC_REMOTES = ['https://github.com/mechane-ai/mechane.git', 'git@github.com:mechane-ai/mechane.git'] as const;

/** Accepts only a clean public checkout whose HEAD matches the declared release tag. */
export const readPublicSource = Effect.fn('readPublicSource')(function* ({
  settings,
}: DistributionInput): Effect.fn.Return<string, DistributionFailed> {
  const remote = yield* runCommand({
    command: 'git',
    args: ['-C', SOURCE_FOLDER, 'remote', 'get-url', 'origin'],
    settings,
  });

  const status = yield* runCommand({ command: 'git', args: ['-C', SOURCE_FOLDER, 'status', '--porcelain'], settings });

  const remoteText = remote.trim();
  const isPublicRemote = PUBLIC_REMOTES.some((candidate) => candidate === remoteText);

  if (!isPublicRemote || status.trim() !== '') {
    return yield* new DistributionFailed({
      step: DistributionStep.Source,
      reason: 'build from a clean public source checkout',
    });
  }

  const head = yield* runCommand({ command: 'git', args: ['-C', SOURCE_FOLDER, 'rev-parse', 'HEAD'], settings });
  const reference = releaseCommitName();
  const tagged = yield* runCommand({ command: 'git', args: ['-C', SOURCE_FOLDER, 'rev-parse', reference], settings });
  const commit = head.trim();

  const isCommit = Schema.is(GitCommit);

  if (!isCommit(commit) || tagged.trim() !== commit) {
    return yield* new DistributionFailed({
      step: DistributionStep.Source,
      reason: 'HEAD must match the public release tag',
    });
  }

  return commit;
});

function releaseCommitName(): string {
  return `refs/tags/v${RELEASE}^{commit}`;
}
