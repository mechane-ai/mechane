import type { ProcessObservation, SandboxProcessAnswer } from '@mechane/sandbox-wire';
import { z } from 'zod';

/** Start outcomes are immutable receipts; current liveness and logs require another exact-handle observation. */
export const ProcessToolResult = z.strictObject({
  status: z.enum(['pending', 'running', 'exited', 'stopped', 'lost', 'refused', 'unavailable', 'uncertain']),
  processId: z.uuid(),
  machineId: z.uuid().optional(),
  output: z.string().optional(),
  omittedBytes: z.number().int().nonnegative().optional(),
  exitCode: z.number().int().optional(),
  message: z.string().optional(),
});

export type ProcessToolResult = z.infer<typeof ProcessToolResult>;

/** Retaining the command rejects a changed payload even after its native start receipt has completed. */
export const ProcessStartReceipt = z.strictObject({ command: z.string(), outcome: ProcessToolResult });

type ProcessAnswerInput = { readonly processId: string; readonly answer: SandboxProcessAnswer };

/** Maps transport admission into model-facing states without claiming application readiness. */
export function processAnswer({ processId, answer }: ProcessAnswerInput): ProcessToolResult {
  if ('handle' in answer) {
    return processObservation(answer);
  }

  switch (answer._tag) {
    case 'ProcessPending':
    case 'ExecutionEnvironmentRequired':
      return { status: 'pending', processId };
    case 'ProcessCanceled':
      return { status: 'refused', processId, message: 'The originating run was canceled before this process started.' };
    case 'ExecutionNotFound':
      return { status: 'unavailable', processId, message: 'The sandbox has no recorded start for this process.' };
    case 'ExecutionReused':
      return { status: 'refused', processId, message: 'This process identity is bound to another start request.' };
    case 'CapacityRefused':
      return { status: 'refused', processId, message: `Sandbox capacity refused this start: ${answer.reason}.` };
  }
}

/** Output remains bounded and redacted by the guest before it reaches native workflow history. */
export function processObservation(observation: ProcessObservation): ProcessToolResult {
  const { handle, state, output } = observation;
  const fields = { ...handle, output: output.text, omittedBytes: output.omittedBytes };

  switch (state._tag) {
    case 'Running':
      return {
        ...fields,
        status: 'running',
        message: 'The process started. Check its output or browser before claiming readiness.',
      };
    case 'Exited':
      return { ...fields, status: 'exited', exitCode: state.exitCode };
    case 'Stopped':
      return { ...fields, status: 'stopped' };
    case 'Lost':
      return { ...fields, status: 'lost', message: 'Its original machine ended; the process was not restarted.' };
  }
}
