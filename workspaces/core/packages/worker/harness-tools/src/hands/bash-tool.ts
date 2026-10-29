import { defineTool } from '@earendil-works/pi-durable';
import type { ToolRegistration } from '@earendil-works/pi-durable';
import {
  DEFAULT_EXECUTION_TIMEOUT,
  EXECUTION_TIMEOUT_MAX,
  ExecutionRequest,
  OUTPUT_TAIL_BYTES,
} from '@mechane/sandbox-wire';
import { Duration, Option, Result, Schema } from 'effect';
import { Type } from 'typebox';
import type { Static } from 'typebox';
import { conversationRole } from '../conversation-role.ts';
import { failedResult } from '../failed-result.ts';
import type { Hands } from '../types.ts';
import { bashResult } from './bash-result.ts';
import { BashDiagnostic } from './constants.ts';
import { executionId } from './execution-id.ts';

type BashToolInput = { readonly hands: Hands };

/** The tool's name, which models are trained to call for a shell; pi stores it in every call, so it is stored too. */
const BASH_TOOL = 'bash';

/**
 * How the tool explains the sandbox to the model, the only place the model learns it. Each sentence restates a promise
 * of the sandbox, so a change to the idle stop, the user, the tools or the network changes it too.
 */
const BASH_DESCRIPTION = [
  'Run a bash command in your sandbox: a Linux machine of your own with bash, git, Node.js and npm.',
  'Each command runs as an unprivileged user and starts in your home directory.',
  'Files last between commands and turns. Production workspaces keep their files while idle machines sleep;',
  'local development machines are disposable.',
  'Network access is limited to configured public hosts such as GitHub, npm and PyPI, with no access to private,',
  'link-local or metadata addresses or Mechane. The sandbox holds no project credentials; clone public repositories.',
  'Commands run one at a time, to completion, cancellation, or their timeout: 120 seconds unless you name up to 600.',
  'Canceling a turn stops its unfinished command; its unfinished file changes may be lost.',
  'Keep work in the foreground; background processes have no lifetime guarantee.',
  'The result is the tail of its combined output.',
].join(' ');

/**
 * What the model passes to bash: the command, and at most how many seconds it may run. Before the call, pi checks the
 * arguments against this TypeBox schema, the only kind its tools take. The tool then decodes them into the sandbox's
 * request, whose schema bounds the command.
 */
const BashParameters = Type.Object({
  command: Type.String({ description: 'The bash command to run' }),
  timeout: Type.Optional(
    Type.Number({
      minimum: 1,
      maximum: Duration.toSeconds(EXECUTION_TIMEOUT_MAX),
      description: 'Seconds the command may run before it is stopped; 120 when absent',
    }),
  ),
});

type BashArguments = Static<typeof BashParameters>;

/**
 * A bash command in the sandbox of the calling conversation's mech or drone, each its own. After a restart, pi may
 * rerun it, since the sandbox, by the execution's id, makes the command run once. A round's commands run one after
 * another, in one home, and a command the sandbox would refuse never reaches it.
 */
export function bashTool({ hands }: BashToolInput): ToolRegistration<typeof BashParameters> {
  const execute: ToolRegistration<typeof BashParameters>['execute'] = async (args, api, context) => {
    const request = executionRequest(args);

    if (Result.isFailure(request)) {
      return failedResult({
        code: BashDiagnostic.Invalid,
        message: `The command cannot run: ${request.failure.message}`,
      });
    }

    const outcome = await hands.run({
      ...request.success,
      executionId: executionId({ taskId: api.taskId }),
      role: await conversationRole({ read: api, conversationId: api.conversationId, context }),
      signal: Option.fromNullishOr(context.abortSignal),
    });

    return bashResult({ outcome, timeout: request.success.timeout });
  };

  return defineTool({
    name: BASH_TOOL,
    description: BASH_DESCRIPTION,
    parameters: BashParameters,
    replay: 'safe',
    executionMode: 'sequential',
    outputLimits: { retain: 'tail', maxBytes: OUTPUT_TAIL_BYTES },
    execute,
  });
}

/** The model's arguments as the sandbox's request: their timeout, 120 seconds when absent, in whole milliseconds. */
function executionRequest({ command, timeout }: BashArguments): Result.Result<ExecutionRequest, Schema.SchemaError> {
  const limit = Option.match(Option.fromNullishOr(timeout), {
    onNone: () => DEFAULT_EXECUTION_TIMEOUT,
    onSome: Duration.seconds,
  });

  return Schema.decodeUnknownResult(Schema.toType(ExecutionRequest))({
    command,
    timeout: Duration.millis(Math.round(Duration.toMillis(limit))),
  });
}
