import { stepLine } from '@mechane/program';
import type { FailureLines } from '@mechane/program';
import { Match, Option } from 'effect';
import { BrowserStep, CliStep, FileStep } from '../constants.ts';
import type { ScenariosFailed } from '../errors.ts';
import type { ScenarioFailure } from '../types.ts';

/** Why the smoke stopped before every scenario passed, other than a stop signal. */
type SmokeFailure = ScenarioFailure | ScenariosFailed;

/** A failure of the smoke, which its message table words. */
type SmokeFailureMessageInput = { readonly failure: SmokeFailure };

/** What a CLI run failed to do, as a diagnostic words it. */
const CLI_STEP_MESSAGES = {
  [CliStep.Exit]: 'it did not exit with the status the scenario expects',
  [CliStep.Refuse]: 'it exited with success, where a refusal was expected',
  [CliStep.Notice]: 'it named no approval page',
  [CliStep.Follow]: 'it exited before the event came',
  [CliStep.Await]: 'the event did not come in time',
} as const satisfies Readonly<Record<CliStep, string>>;

/** The browser's steps, as a diagnostic words them. */
const BROWSER_STEP_MESSAGES = {
  [BrowserStep.OpenDevicePage]: 'open the device page',
  [BrowserStep.SignIn]: 'sign in at the local GitHub',
  [BrowserStep.ReturnFromGitHub]: 'return from GitHub',
  [BrowserStep.Open]: 'open',
  [BrowserStep.PostForm]: 'post the form',
  [BrowserStep.ShowCodeForm]: 'show the code form',
  [BrowserStep.ReviewCode]: 'review the typed code',
  [BrowserStep.Approve]: 'approve',
  [BrowserStep.ApproveWithKey]: 'approve with a key',
  [BrowserStep.StartApproval]: 'start a device approval',
} as const satisfies Readonly<Record<BrowserStep, string>>;

/** A scenario's steps on a file or a folder, as a diagnostic words them before the path. */
const FILE_STEP_MESSAGES = {
  [FileStep.Create]: 'create a folder in',
  [FileStep.Read]: 'read',
  [FileStep.List]: 'list',
  [FileStep.Write]: 'write',
  [FileStep.Decode]: 'decode',
  [FileStep.Await]: 'wait for a line in',
} as const satisfies Readonly<Record<FileStep, string>>;

/** The smoke's one message table: the diagnostic of each failure, from its fields. */
const FAILURE_MESSAGES: Readonly<FailureLines<SmokeFailure>> = {
  CheckFailed: ({ name, reason }) => `check ${name}: ${reason}`,
  BrowserRefused: ({ step, url, reason }) => `browse to ${BROWSER_STEP_MESSAGES[step]} at ${url.href}: ${reason}`,
  FileStepFailed: ({ step, path, reason }) => `${FILE_STEP_MESSAGES[step]} ${path}: ${reason}`,
  CliFailed: ({ command, step, status, stderr }) =>
    `run mechane ${command}: ${CLI_STEP_MESSAGES[step]}, status ${Option.getOrElse(status, () => 'none')}; ${stderr}`,
  CliUndecoded: ({ command, stderr, reason }) =>
    `run mechane ${command}: its output does not decode: ${reason}; ${stderr}`,
  ProcessFailed: ({ command, reason }) => `run ${command}: ${reason}`,
  ScenariosFailed: ({ failedScenarios }) => `scenarios failed: ${failedScenarios}`,
  ReleaseFailed: stepLine,
  StackFailed: stepLine,
};

/** The diagnostic of a failure that ended a scenario or the smoke, as the smoke's message table words it. */
export function smokeFailureMessage({ failure }: SmokeFailureMessageInput): string {
  return Match.valueTags(failure, FAILURE_MESSAGES);
}
