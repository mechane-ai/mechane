import type { SourceId } from '@mechane/records';
import { join } from 'node:path';

/** A source checkout's generation-specific directory beneath the guest home. */
type SourceStagingPathInput = { readonly home: string; readonly generation: SourceId };

/** Staging stays separate from active checkouts until credential revocation and activation complete. */
export function sourceStagingPath({ home, generation }: SourceStagingPathInput): string {
  return join(home, `.mechane-source-${generation}`);
}
