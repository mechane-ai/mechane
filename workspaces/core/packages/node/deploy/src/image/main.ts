import { PROGRAM } from '@mechane/deploy-kernel';
import type { DeployFailed } from '@mechane/deploy-kernel';
import { finish, reportExit, stepLine } from '@mechane/program';
import type { FailureLines } from '@mechane/program';
import { Effect, Match } from 'effect';
import { publishImage } from './publish-image.ts';

const FAILURE_LINES: Readonly<FailureLines<DeployFailed>> = { DeployFailed: stepLine };
const ImageStatus = { Done: 0, Failed: 1 } as const;
type FailureInput = { readonly failure: DeployFailed };

async function main(): Promise<void> {
  const publish = publishImage();
  const scoped = Effect.scoped(publish);
  const exit = await Effect.runPromiseExit(scoped);
  const describe: (input: FailureInput) => string = ({ failure }) => Match.valueTags(failure, FAILURE_LINES);

  const status = reportExit({
    exit,
    program: PROGRAM,
    operation: 'publish the sandbox image',
    describe,
    succeeded: () => ImageStatus.Done,
    failed: ImageStatus.Failed,
  });

  finish({ status });
}

await main();
