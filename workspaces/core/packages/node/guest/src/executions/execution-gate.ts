import type { ExecutionLedger } from '../types.ts';

type ExecutionKnownInput = { readonly isKnown: boolean };

type ExecutionGate = Pick<
  ExecutionLedger,
  'quiesce' | 'resume' | 'isFrozen' | 'admitProcess' | 'finishProcessStart'
> & {
  readonly isBlocked: (input: ExecutionKnownInput) => boolean;
  readonly started: () => void;
  readonly settled: () => void;
};

/** Admits one command at a time and freezes new commands while a workspace operation owns the guest. */
export function executionGate(): ExecutionGate {
  const state = { isFrozen: false, isRunning: false, startingProcesses: 0 };
  const isBlocked: ExecutionGate['isBlocked'] = ({ isKnown }) => !isKnown && (state.isFrozen || state.isRunning);

  const started: ExecutionGate['started'] = () => {
    state.isRunning = true;
  };

  const settled: ExecutionGate['settled'] = () => {
    state.isRunning = false;
  };

  const resume: ExecutionGate['resume'] = () => {
    state.isFrozen = false;
  };

  const quiesce: ExecutionGate['quiesce'] = () => {
    state.isFrozen = !state.isRunning && state.startingProcesses === 0;

    return state.isFrozen;
  };

  const admitProcess: ExecutionGate['admitProcess'] = () => {
    if (state.isFrozen) {
      return false;
    }

    Object.assign(state, { startingProcesses: state.startingProcesses + 1 });

    return true;
  };

  const finishProcessStart: ExecutionGate['finishProcessStart'] = () => {
    Object.assign(state, { startingProcesses: state.startingProcesses - 1 });
  };

  return {
    isBlocked,
    started,
    settled,
    quiesce,
    resume,
    isFrozen: () => state.isFrozen,
    admitProcess,
    finishProcessStart,
  };
}
