import type { BetaRunnableTool } from '@anthropic-ai/sdk/lib/tools/BetaRunnableTool';
import { ToolError } from '@anthropic-ai/sdk/lib/tools/ToolError';
import { betaBashTool } from '@anthropic-ai/sdk/tools/agent-toolset/node';
import type { AgentToolContext } from '@anthropic-ai/sdk/tools/agent-toolset/node';
import { Bytes } from '@mechane/records';
import type { ExecutionEnvironment } from '@mechane/sandbox-wire';
import { Effect, Option, Redacted, Schema } from 'effect';
import { isDeepStrictEqual } from 'node:util';
import { InstalledCommandFailed } from '../errors.ts';
import { redactExecutionOutput } from '../executions/redact-execution-output.ts';
import { bindShellAccess } from '../executions/shell-environment.ts';
import type { startComputerRelay } from './computer-relay.ts';

type ComputerAccess = Pick<Awaited<ReturnType<typeof startComputerRelay>>, 'socket' | 'ticket'>;
type ShellEnvironment = Readonly<Record<string, string>>;
type ActiveShell = { readonly environment: ShellEnvironment; readonly bash: BetaRunnableTool };
export type RunInstalledCommand = (effect: Effect.Effect<string, ToolError>) => Promise<string>;

type InstalledBash = {
  readonly context: AgentToolContext;
  readonly tool: BetaRunnableTool;
  readonly shell: ShellEnvironment;
  readonly computer: ComputerAccess;
  readonly signal: AbortSignal;
  readonly access: (input: Pick<Request, 'signal'>) => Effect.Effect<ExecutionEnvironment, InstalledCommandFailed>;
  readonly runCommand: RunInstalledCommand;
};

type Output = { readonly text: string; readonly environment: ExecutionEnvironment };
type Run = { readonly input: unknown; readonly invocation: Parameters<BetaRunnableTool['run']>[1] };
type Invoke = Run & Pick<Output, 'environment'> & { readonly bash: BetaRunnableTool };
const TRUNCATED = '[output truncated]\n';
const textFailure = Schema.is(Schema.Struct({ content: Schema.String }));

function redact({ text, environment }: Output): string {
  const truncated = text.startsWith(TRUNCATED);
  let omittedBytes = Bytes.make(0);
  let retained = text;

  if (truncated) {
    omittedBytes = Bytes.make(1);
    retained = text.slice(TRUNCATED.length);
  }

  const request = { environment: Option.some(environment) };
  const safe = redactExecutionOutput({ output: { omittedBytes, text: retained }, request, hasCompleteEnd: true });

  if (truncated) {
    return TRUNCATED + safe.text;
  }

  return safe.text;
}

async function invoke({
  bash,
  input,
  invocation,
  environment,
}: Invoke): Promise<Awaited<ReturnType<BetaRunnableTool['run']>>> {
  const value = await bash.run(input, invocation);

  if (typeof value === 'string') {
    return redact({ text: value, environment });
  }

  return value;
}

type FailureOutput = Pick<Output, 'environment'> & { readonly failure: unknown };

function failureText({ failure, environment }: FailureOutput): string {
  if (textFailure(failure)) {
    return redact({ text: failure.content, environment });
  }

  return 'The Bash command could not finish';
}

class BashFailure extends Schema.TaggedError<BashFailure>()('BashFailure', { reason: Schema.String }) {
  constructor(input: FailureOutput) {
    const reason = failureText(input);

    super({ reason });
  }
}

export function installedBash({
  context,
  tool,
  shell,
  computer,
  access,
  signal,
  runCommand,
}: InstalledBash): BetaRunnableTool {
  const base = { ...shell, MECHANE_COMPUTER_SOCKET: computer.socket, MECHANE_COMPUTER_TICKET: computer.ticket };
  let active = Option.none<ActiveShell>();

  async function close(): Promise<void> {
    const current = Option.flatMap(active, (entry) => Option.fromNullishOr(entry.bash.close));
    active = Option.none();

    if (Option.isSome(current)) {
      await current.value();
    }
  }

  const discardCommandShell = Effect.fn('discardCommandShell')(function* (): Effect.fn.Return<
    void,
    InstalledCommandFailed
  > {
    yield* Effect.tryPromise({
      try: () => close(),
      catch: () => new InstalledCommandFailed({ reason: 'Unable to retire the previous command shell' }),
    });
  });

  const selectCommandShell = Effect.fn('selectCommandShell')(function* ({
    environment,
  }: Pick<Output, 'environment'>): Effect.fn.Return<BetaRunnableTool, InstalledCommandFailed> {
    const bound = bindShellAccess({ base, access: environment });

    if (Option.isSome(active) && isDeepStrictEqual(active.value.environment, bound)) {
      return active.value.bash;
    }

    yield* discardCommandShell();

    const bash = betaBashTool({ ...context, env: bound });
    active = Option.some({ environment: bound, bash });

    return bash;
  });

  const runInstalledBash = Effect.fn('runInstalledBash')(function* ({
    input,
    invocation,
  }: Run): Effect.fn.Return<string, InstalledCommandFailed | BashFailure> {
    const signals = [signal];
    const optional = Option.fromNullishOr(invocation);
    const toolSignal = Option.flatMap(optional, (value) => Option.fromNullishOr(value.signal));

    if (Option.isSome(toolSignal)) {
      signals.push(toolSignal.value);
    }

    const commandSignal = AbortSignal.any(signals);
    const lookup = access({ signal: commandSignal });
    const current = yield* Effect.tapError(lookup, discardCommandShell);
    const secrets = { ...current.secrets, MECHANE_COMPUTER_TICKET: Redacted.make(computer.ticket) };
    const environment = { ...current, secrets };
    const bash = yield* selectCommandShell({ environment });

    const result = yield* Effect.tryPromise({
      try: () => invoke({ bash, input, invocation, environment }),
      catch: (failure) => new BashFailure({ failure, environment }),
    });

    if (typeof result !== 'string') {
      return yield* new InstalledCommandFailed({ reason: 'Unexpected Bash result format' });
    }

    return result;
  });

  return {
    ...tool,
    close,
    async run(input: unknown, invocation) {
      const command = runInstalledBash({ input, invocation });
      const result = Effect.mapError(command, (failure) => new ToolError(failure.reason));

      return await runCommand(result);
    },
  };
}
