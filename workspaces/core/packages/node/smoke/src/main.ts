import { finish, interruptOnSignal } from '@mechane/program';
import { smokeStatus } from '@mechane/testing';
import { Effect } from 'effect';
import { runScenarios } from './run-scenarios.ts';

/** Runs every scenario of the catalog against a fresh local stack, stops the stack, and finishes. */
async function main(): Promise<void> {
  const exit = await Effect.runPromiseExit(interruptOnSignal({ program: Effect.scoped(runScenarios()) }));

  finish({ status: smokeStatus({ exit }) });
}

await main();
