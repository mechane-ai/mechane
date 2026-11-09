import type { ToolExecutionOptions, ToolSet } from 'ai';
import { Record } from 'effect';
import { z } from 'zod';
import { withRuntimeStore } from '../store/runtime-store.ts';
import type { RuntimeToolContext } from './types.ts';

const ToolContext = z.strictObject({ presentedSequence: z.number().int().nonnegative() });

const NotStarted = z.strictObject({
  status: z.literal('not_started'),
  reason: z.enum(['notifications_pending', 'execution_stopped']),
});

const ExecuteOnlyHooks = z.object({
  needsApproval: z.literal(false).optional(),
  onInputStart: z.never().optional(),
  onInputDelta: z.never().optional(),
  onInputAvailable: z.never().optional(),
});

type GuardToolsInput = { readonly context: RuntimeToolContext; readonly tools: ToolSet };

type DispatchInput = {
  readonly runId: string;
  readonly toolCallId: string;
  readonly toolName: string;
  readonly presentedSequence: number;
};

/** Admission is recorded before effects so replay preserves an already-started call when newer input arrives. */
export function guardToolDispatch({ context, tools }: GuardToolsInput): ToolSet {
  const guarded: ToolSet = {};

  for (const [name, candidate] of Record.toEntries(tools)) {
    const execute = candidate.execute;
    const toModelOutput = candidate.toModelOutput;

    if (candidate.type === 'provider' || execute === undefined) {
      throw new Error(`Runtime tool ${name} has no local execution boundary.`);
    }

    requireExecuteOnlyHooks({ name, candidate });

    const definition: ToolSet[string] = {
      ...candidate,
      contextSchema: ToolContext,
      execute: async (input: unknown, options: ToolExecutionOptions<unknown>): Promise<unknown> => {
        const presented = ToolContext.parse(options.context);

        const admission = await admitDispatch({
          runId: context.runId,
          toolCallId: options.toolCallId,
          toolName: name,
          presentedSequence: presented.presentedSequence,
        });

        if (admission.status === 'not_started') {
          return admission;
        }

        return await execute(input, options);
      },
    };

    if (toModelOutput !== undefined) {
      definition.toModelOutput = async (options: {
        readonly toolCallId: string;
        readonly input: unknown;
        readonly output: unknown;
      }) => {
        const blocked = NotStarted.safeParse(options.output);

        if (blocked.success) {
          return { type: 'json' as const, value: blocked.data };
        }

        return await toModelOutput(options);
      };
    }

    guarded[name] = definition;
  }

  return guarded;
}

function requireExecuteOnlyHooks({
  name,
  candidate,
}: {
  readonly name: string;
  readonly candidate: ToolSet[string];
}): void {
  const checked = ExecuteOnlyHooks.safeParse(candidate);

  if (!checked.success) {
    throw new Error(`Runtime tool ${name} must use admitted execute without native approval or input hooks.`);
  }
}

async function admitDispatch(input: DispatchInput) {
  'use step';

  return await withRuntimeStore((store) => store.admitToolDispatch(input));
}
