import { finish, interruptOnSignal, reportExit } from '@mechane/program';
import type { FailureLines } from '@mechane/program';
import { Effect, Match } from 'effect';
import { serveGuest } from './serve-guest.ts';
import type { GuestFailure } from './types.ts';

/** The guest's name, which prefixes each diagnostic it writes. */
const GUEST_PROGRAM = 'mechane guest';

/** How the guest ends: a stop signal ends a healthy guest, and one that could not serve ends as failed. */
const GuestStatus = { Stopped: 0, Failed: 1 } as const;

/** What each failure of the guest says it did and why it failed. */
const FAILURE_LINES: Readonly<FailureLines<GuestFailure>> = {
  GuestMisconfigured: ({ reason }) => `read the guest's environment: ${reason}`,
  GuestUnreachable: ({ host, port, reason }) => `listen on ${host}:${port}: ${reason}`,
  ExecutionUnstarted: ({ executionId, reason }) => `start bash for execution ${executionId}: ${reason}`,
};

/**
 * Serves the machine's executions until a stop signal arrives, which stops every execution still running and ends the
 * guest stopped. A guest that never restarts is what lets an execution's id run once.
 */
async function main(): Promise<void> {
  const exit = await Effect.runPromiseExit(interruptOnSignal({ program: serveGuest() }));

  const status = reportExit({
    exit,
    program: GUEST_PROGRAM,
    operation: 'serve the machine',
    describe: ({ failure }) => Match.valueTags(failure, FAILURE_LINES),
    succeeded: () => GuestStatus.Stopped,
    failed: GuestStatus.Failed,
  });

  finish({ status });
}

await main();
