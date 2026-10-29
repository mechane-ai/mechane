import { standardMessage } from '@mechane/checks-kernel';
import { MESSAGE_FORM } from '@mechane/rule-shapes';
import type { OwnedExample } from '@mechane/rule-shapes';
import { Record } from 'effect';
import { exampleIndex } from './example-index.ts';
import type { ExampleRun, ExampleWorkspace } from './types.ts';

/**
 * One example of the owned rule `name`, the run that decides on it, what its index shares with the workspace, and
 * whether the rule should flag it.
 */
type ExampleMessagesInput = {
  readonly name: string;
  readonly run: ExampleRun;
  readonly example: OwnedExample;
  readonly workspace: ExampleWorkspace;
  readonly isViolation: boolean;
};

/**
 * What one example shows under its rule's run, each finding ended with the rule's standard. It is a violation the run
 * does not flag, or whose finding does not read as AS-01 says, or an allowed example the run flags.
 */
export function exampleMessages({
  name,
  run,
  example,
  workspace,
  isViolation,
}: ExampleMessagesInput): ReadonlyArray<string> {
  const found = run(exampleIndex({ example, workspace }))
    .filter(({ rule }) => rule === name)
    .map((finding) => standardMessage(finding));

  const paths = Record.keys(example).join(', ');

  if (!isViolation) {
    /** The message of a finding the run reports for an allowed example. */
    const flaggedMessage: (message: string) => string = (message) =>
      `Fix ${name} or its allowed example, such as \`${paths}\`, which it flags: ${message} (TS-05)`;

    return found.map(flaggedMessage);
  }

  if (found.length === 0) {
    return [`Fix ${name} or its violation example, such as \`${paths}\`, which it does not flag (TS-05)`];
  }

  /** Whether a finding does not read as AS-01 says. */
  const isMisread: (message: string) => boolean = (message) => !MESSAGE_FORM.test(message);

  /** The message of a violation's finding that does not read as AS-01 says. */
  const rewordMessage: (message: string) => string = (message) =>
    `Reword the finding of ${name}, such as \`Name it, such as 'isReady' (NM-07)\`, since it reads: ${message} (AS-01)`;

  return found.filter(isMisread).map(rewordMessage);
}
