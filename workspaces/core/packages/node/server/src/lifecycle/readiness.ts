type LifecyclePhase = 'starting' | 'ready' | 'draining';

export type Readiness = {
  readonly isReady: () => boolean;
  readonly markReady: () => void;
  readonly beginDrain: () => void;
};

export function createReadiness(): Readiness {
  let phase: LifecyclePhase = 'starting';

  return {
    isReady: () => phase === 'ready',
    markReady: () => {
      phase = 'ready';
    },
    beginDrain: () => {
      phase = 'draining';
    },
  };
}
