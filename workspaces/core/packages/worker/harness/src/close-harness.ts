import { BACKGROUND_CONTEXT } from '@earendil-works/chord/context';
import { waitFor } from '@mechane/utilities';
import { Duration } from 'effect';
import type { HarnessHandle } from './types.ts';

/**
 * Closes pi's Harness and its storage once pi's line has run what pi already began. The event loop turns first, so an
 * answer that a settled dispatch just handed pi reaches the line. A read on the line then waits behind its commit,
 * which the close would otherwise refuse, and pi would send the dispatch again.
 */
export async function closeHarness({ harness }: HarnessHandle): Promise<void> {
  await waitFor({ span: Duration.zero });
  await harness.inspect(BACKGROUND_CONTEXT);
  await harness.close(BACKGROUND_CONTEXT);
}
