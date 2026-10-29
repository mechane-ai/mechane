import type { CloudClient } from '@tensorlakeai/tensorlake';
import { Effect } from 'effect';

/** Releases the native SDK client when its acquisition scope ends, including an interrupted image build. */
export const closeImageClient: (client: CloudClient) => Effect.Effect<void> = (client) =>
  Effect.sync(() => client.close());
