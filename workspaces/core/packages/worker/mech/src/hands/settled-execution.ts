import { SandboxRefusal } from '@mechane/harness-tools';
import type { HandsOutcome } from '@mechane/harness-tools';
import { LeaseDecision, MACHINE_LEASE } from '@mechane/rpc';
import { Duration, Match, Option, Schema } from 'effect';
import { askedExecution } from './asked-execution.ts';
import { refusedOutcome } from './refused-outcome.ts';
import type { SettledExecutionInput } from './types.ts';

/**
 * Asks the sandbox for the execution until it settles, leasing one of the workspace's machines before each ask. A
 * workspace that runs every machine it may refuses the command.
 */
export async function settledExecution({
  sandbox,
  workspace,
  target,
  execution,
  signal,
  aborted,
}: SettledExecutionInput): Promise<HandsOutcome> {
  let outcome: Option.Option<HandsOutcome> = Option.none();

  while (Option.isNone(outcome)) {
    outcome = await leasedAsk({ sandbox, workspace, target, execution, signal, aborted });
  }

  return outcome.value;
}

/**
 * Leases a machine to the sandbox, renewing the lease it holds, and asks for the execution once. It answers the
 * execution's outcome, none while it runs, or the refusal of a full workspace.
 */
async function leasedAsk({
  sandbox,
  workspace,
  target,
  execution,
  signal,
  aborted,
}: SettledExecutionInput): Promise<Option.Option<HandsOutcome>> {
  signal.throwIfAborted();

  const { sandboxId, machines } = target;
  const decision = await workspace.leaseMachine({ sandboxId, machines, leaseMs: Duration.toMillis(MACHINE_LEASE) });

  const full: () => Option.Option<HandsOutcome> = () =>
    Option.some(refusedOutcome({ target, reason: SandboxRefusal.MachinesFull }));

  return await Match.valueTags(Schema.decodeUnknownSync(LeaseDecision)(decision), {
    Leased: async () => await askedExecution({ sandbox, execution, signal, aborted }),
    Full: full,
  });
}
