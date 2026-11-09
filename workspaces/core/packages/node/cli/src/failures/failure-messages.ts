import type { UsageProblem } from '@mechane/cli-kernel';
import { API_KEY_VARIABLE, COMMANDS, ExitStatus, PROGRAM } from '@mechane/commands';
import { Match, Option, Record } from 'effect';
import { CLIENT_FAILURE_MESSAGES } from './client-failure-messages.ts';
import { CREDENTIAL_FAILURE_MESSAGES } from './credential-failure-messages.ts';
import { EVAL_FAILURE_MESSAGES } from './eval-failure-messages.ts';
import { ownMessage } from './own-message.ts';
import type { Failure, FailureMessages } from './types.ts';
import { UPDATE_FAILURE_MESSAGES } from './update-failure-messages.ts';

/** What a command line that does not decode says, under each problem's tag; a tag without one fails to compile. */
type UsageMessages = {
  readonly [T in UsageProblem['_tag']]: (problem: Extract<UsageProblem, Readonly<Record<'_tag', T>>>) => string;
};

/** How a command line writes an argument a command requires, as its help does. */
const argumentUsage: (name: string) => string = (name) => `<${name}>`;

/** Why a command line or the environment does not decode, as each problem's fields say. */
const USAGE_MESSAGES: Readonly<UsageMessages> = {
  ArgumentsUnparsed: ({ reason }) => reason,
  FlagsInvalid: ({ reason }) => reason,
  CommandUnnamed: () => `name one command of ${Record.keys(COMMANDS).join(', ')}`,
  ArgumentsMismatched: ({ command, arguments: names }) =>
    `${command} takes the arguments [${names.map(argumentUsage).join(' ')}]`,
  InputInvalid: ({ command, reason }) => `${command}: ${reason}`,
  OriginInvalid: ({ origin, reason }) => `origin ${origin}: ${reason}`,
  OutputModeRefused: ({ mode, modes }) => `output ${mode} is not one of ${modes.join(', ')}, which this command writes`,
  ApiKeyInvalid: () => `${API_KEY_VARIABLE} holds no Mechane key; set it to a key file's contents`,
};

const NO_NEXT_STEP = Option.none<string>();

/**
 * The one message table of the CLI: the report of each failure it meets, derived from the failure's fields alone and
 * gathered from the tables of the failures' owners.
 */
export const FAILURE_MESSAGES: Readonly<FailureMessages<Failure>> = {
  WorkspaceSelectionRefused: ({ _tag, workspaceId }) => {
    const next = Option.some(`run ${PROGRAM} workspace list`);

    return ownMessage({
      code: _tag,
      status: ExitStatus.ForbiddenOrNotFound,
      message: `workspace ${workspaceId} is not one you belong to`,
      next,
    });
  },
  SandboxMaintenanceFailed: ({ _tag, reason }) =>
    ownMessage({ code: _tag, status: ExitStatus.Failed, message: reason, next: NO_NEXT_STEP }),
  ...CLIENT_FAILURE_MESSAGES,
  ...CREDENTIAL_FAILURE_MESSAGES,
  ...EVAL_FAILURE_MESSAGES,
  ...UPDATE_FAILURE_MESSAGES,
  UsageInvalid: ({ _tag, problem }) =>
    ownMessage({
      code: _tag,
      status: ExitStatus.InvalidRequest,
      message: Match.valueTags(problem, USAGE_MESSAGES),
      next: Option.some(`run ${PROGRAM} --help`),
    }),
};
