import { HandsRefusal } from '@mechane/harness-tools';
import type { HandsOutcome, SandboxRefusal } from '@mechane/harness-tools';
import { writeLog } from '@mechane/logs';
import { LogEvent } from '@mechane/protocol';
import type { MachineTarget } from './types.ts';

/** The command's target, and why its hands refuse it. */
type RefusedOutcomeInput = { readonly target: MachineTarget; readonly reason: SandboxRefusal };

/** Logs a refusal by its workspace, mech and reason, and answers it with the workspace's machines. */
export function refusedOutcome({ target, reason }: RefusedOutcomeInput): HandsOutcome {
  const { workspaceId, mechId, machines } = target;

  writeLog({ line: { event: LogEvent.SandboxRefused, workspaceId, mechId, reason } });

  return HandsRefusal.make({ reason, machines });
}
