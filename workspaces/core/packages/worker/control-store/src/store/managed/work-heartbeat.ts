type LeaseSnapshot = {
  readonly state: 'queued' | 'starting' | 'active' | 'stopping' | 'stopped';
  readonly latest_heartbeat_at: string | null;
  readonly ttl_seconds: number;
};

export function heartbeatConflict(lease: LeaseSnapshot) {
  return {
    type: 'invalid_request_error',
    details: {
      error_code: 'heartbeat_precondition_failed',
      current_state: {
        state: lease.state,
        last_heartbeat: lease.latest_heartbeat_at,
        ttl_seconds: lease.ttl_seconds,
        lease_extended: false,
      },
    },
  } as const;
}
