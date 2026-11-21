import type { EnvironmentWorkerTools } from '@anthropic-ai/sdk/lib/environments/worker';
import type { BetaRunnableTool } from '@anthropic-ai/sdk/lib/tools/BetaRunnableTool';
import { betaAgentToolset20260401 } from '@anthropic-ai/sdk/tools/agent-toolset/node';
import type { ManagedWorkerClaim } from '@mechane/sandbox-wire';
import { capturePromise } from '@mechane/utilities';
import { Option, Predicate, Result } from 'effect';
import { prepareManagedGitCheckout } from './checkout.ts';
import { readCommandEnvironment } from './command-environment.ts';
import type { startComputerRelay } from './computer-relay.ts';
import { installedBash } from './installed-bash.ts';
import type { RunInstalledCommand } from './installed-bash.ts';

const BASH = 'bash';
const MOUNTED_RESOURCE_TYPES: ReadonlySet<string> = new Set(['github_repository', 'file']);

type SessionTools = {
  readonly workdir: string;
  readonly origin: string;
  readonly sessionId: ManagedWorkerClaim['sessionId'];
  readonly token: string;
  readonly shell: Readonly<Record<string, string>>;
  readonly transport: typeof fetch;
  readonly computer: Awaited<ReturnType<typeof startComputerRelay>>;
  readonly runCommand: RunInstalledCommand;
  readonly signal: AbortSignal;
};

type Mounted = Awaited<ReturnType<typeof prepareManagedGitCheckout>>;
type Mount = Promise<Result.Result<Mounted, unknown>>;
type SessionToolFactory = Exclude<EnvironmentWorkerTools, ReadonlyArray<BetaRunnableTool>>;
type InstalledTools = { readonly tools: SessionToolFactory; readonly close: () => Promise<void> };

export function installedSessionTools({
  workdir,
  origin,
  sessionId,
  token,
  shell,
  transport,
  computer,
  runCommand,
  signal,
}: SessionTools): InstalledTools {
  const mount = { pending: Option.none<Mount>() };

  function access({ signal: commandSignal }: Pick<Request, 'signal'>): ReturnType<typeof readCommandEnvironment> {
    return readCommandEnvironment({ origin, sessionId, token, transport, signal: commandSignal });
  }

  const tools: SessionToolFactory = (context) => {
    const standard = betaAgentToolset20260401(context).map((tool) => {
      if (tool.name === BASH) {
        return installedBash({ context, tool, shell, computer, access, signal, runCommand });
      }

      return tool;
    });

    const { session } = context;

    if (
      Predicate.isUndefined(session) ||
      !session.resources.some((resource) => MOUNTED_RESOURCE_TYPES.has(resource.type))
    ) {
      return standard;
    }

    const pending = Option.getOrElse(mount.pending, () => {
      const promise = prepareManagedGitCheckout({
        origin,
        sessionId,
        session,
        token,
        transport,
        workspace: workdir,
        signal,
      });

      return capturePromise({ promise });
    });

    mount.pending = Option.some(pending);

    return standard.map((tool): BetaRunnableTool => ({
      ...tool,
      async run(input: unknown, toolContext) {
        const mounted = await pending;

        Result.getOrThrow(mounted);
        signal.throwIfAborted();

        const invocationSignal = Option.fromNullishOr(toolContext).pipe(
          Option.flatMap((invocation) => Option.fromNullishOr(invocation.signal)),
        );

        if (Option.isSome(invocationSignal)) {
          invocationSignal.value.throwIfAborted();
        }

        return await tool.run(input, toolContext);
      },
    }));
  };

  async function close(): Promise<void> {
    if (Option.isSome(mount.pending)) {
      const settled = await mount.pending.value;

      if (Result.isSuccess(settled)) {
        await settled.success.close();
      }
    }
  }

  return { tools, close };
}
