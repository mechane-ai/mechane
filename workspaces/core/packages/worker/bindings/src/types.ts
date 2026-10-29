import type { KeyPurpose } from '@mechane/protocol';
import type { ObjectBindings } from '@mechane/rpc';
import type { Duration } from 'effect';
import type { WorkerVariables } from './schemas.ts';

/** The variables as the Worker uses them, with each purpose's key lifetime in place of its two variables. */
type WorkerConfiguration = Omit<WorkerVariables, 'loginKeyLifetimeSeconds' | 'namedKeyLifetimeSeconds'>;

/** Everything the Worker reads from its environment, decoded once per request. */
export type WorkerSettings = WorkerConfiguration &
  ObjectBindings & {
    /** The lifetime of a new key of each purpose. */
    readonly keyLifetimes: Readonly<Record<KeyPurpose, Duration.Duration>>;
    /** The bucket of the CLI's releases, which the Worker serves read-only. */
    readonly releases: R2Bucket;
  };
