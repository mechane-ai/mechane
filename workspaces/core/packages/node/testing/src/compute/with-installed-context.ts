import type { LocalStack } from '@mechane/stack';
import type { ManagedContext } from '../managed-context.ts';
import { closeInstalledContext } from './close-installed-context.ts';
import { createInstalledContext } from './create-installed-context.ts';

type InstalledScenario = {
  readonly stack: LocalStack;
  readonly name: string;
  readonly run: (context: ManagedContext) => Promise<void>;
};

/** Capture the failing session before deletion and retain independently failing teardown. */
export async function withInstalledContext({ stack, name, run }: InstalledScenario): Promise<void> {
  const context = await createInstalledContext({ stack, name });
  const failures: Array<unknown> = [];

  try {
    await run(context);
  } catch (error) {
    failures.push(error);
    await stack.captureFailure(name).catch(() => undefined);
  } finally {
    await closeInstalledContext(context).catch((error: unknown) => failures.push(error));
  }

  if (failures.length > 0) {
    throw new AggregateError(failures, `Installed session scenario ${name} failed`, { cause: failures[0] });
  }
}
