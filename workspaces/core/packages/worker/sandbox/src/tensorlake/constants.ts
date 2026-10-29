/** A named process either runs or retains its exit receipt. */
export const ProcessStatus = { Running: 'running', Exited: 'exited' } as const;

/** Tensorlake's control API, reached only by the Worker. */
export const TENSORLAKE_ORIGIN = 'https://api.tensorlake.ai';

/** Lifecycle states returned by the sandbox API. */
export const TensorlakeStatus = {
  Pending: 'pending',
  Running: 'running',
  Snapshotting: 'snapshotting',
  Suspending: 'suspending',
  Suspended: 'suspended',
  Terminated: 'terminated',
} as const;

/** Fixed collection endpoints of Tensorlake's control and guest APIs. */
export const TensorlakePath = { Sandboxes: '/sandboxes', Processes: '/api/v1/processes' } as const;
