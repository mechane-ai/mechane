import { Bytes } from '@mechane/records';
import { PROCESS_HISTORY_MAX_ENTRIES, PROCESS_MAX_INSTANCES, ProcessState } from '@mechane/sandbox-wire';
import type { ExecutionOutput, ProcessId, ProcessObservation, ProcessStart } from '@mechane/sandbox-wire';
import { Deferred, Duration, Effect, FiberSet, MutableRef, Option } from 'effect';
import type { ExecutionUnstarted } from '../errors.ts';
import type { ExecutionLedger, GuestSettings } from '../types.ts';
import { ProcessFailed } from './process-failed.ts';
import { processFingerprint } from './process-fingerprint.ts';
import { runManagedProcess } from './run-managed-process.ts';
import type { ManagedProcess, ProcessIdInput, ProcessLedger } from './types.ts';

const STOP_TIMEOUT = Duration.seconds(3);
const EMPTY_OUTPUT: Readonly<ExecutionOutput> = { text: '', omittedBytes: Bytes.make(0) };

type ProcessLedgerInput = {
  readonly settings: GuestSettings;
  readonly ledger: ExecutionLedger;
  readonly fibers: FiberSet.FiberSet<void, ExecutionUnstarted>;
};

/** Retains exact process identities while bounding concurrent children and retained log tails. */
export function processLedger({ settings, ledger, fibers }: ProcessLedgerInput): ProcessLedger {
  const processes = new Map<ProcessId, ManagedProcess>();
  const settled: Array<ManagedProcess> = [];

  const list: ProcessLedger['list'] = () => {
    const running = [...processes.values()].filter((managed) => !Deferred.isDoneUnsafe(managed.settled));
    const recent = settled.toReversed();

    return [...running, ...recent].map(({ handle, state }) => ({ handle, state: MutableRef.get(state).outcome }));
  };

  const ownedProcessGroups: ProcessLedger['ownedProcessGroups'] = () => {
    const states = [...processes.values()].map((managed) => MutableRef.get(managed.state));
    const runs = states.flatMap((state) => Option.toArray(state.run));

    return runs.map((run) => run.groupId);
  };

  const start = Effect.fn('start')(function* (
    request: ProcessStart,
  ): Effect.fn.Return<ProcessObservation, ProcessFailed> {
    const fingerprint = processFingerprint({ request });
    const existing = processes.get(request.processId);
    const known = Option.fromNullishOr(existing);

    if (Option.isSome(known)) {
      if (known.value.fingerprint !== fingerprint) {
        return yield* new ProcessFailed({
          processId: request.processId,
          reason: 'process identity already names another request',
        });
      }

      yield* Deferred.await(known.value.ready);

      return observeProcess({ managed: known.value });
    }

    const running = [...processes.values()].filter((managed) => !Deferred.isDoneUnsafe(managed.settled));

    if (running.length >= PROCESS_MAX_INSTANCES || !ledger.admitProcess()) {
      return yield* new ProcessFailed({
        processId: request.processId,
        reason: 'guest cannot admit another managed process',
      });
    }

    const run = Option.none();
    const outcome = ProcessState.cases.Running.make({});

    const managed: ManagedProcess = {
      handle: { processId: request.processId, machineId: settings.machineId },
      fingerprint,
      ready: Deferred.makeUnsafe<void>(),
      settled: Deferred.makeUnsafe<void>(),
      state: MutableRef.make({ run, outcome, readOutput: () => EMPTY_OUTPUT, isStopRequested: false }),
    };

    processes.set(request.processId, managed);

    const onSettled: () => void = () => {
      settled.push(managed);

      if (settled.length <= PROCESS_HISTORY_MAX_ENTRIES) {
        return;
      }

      const oldest = settled.splice(0, 1);

      for (const entry of oldest) {
        discardProcessOutput({ managed: entry });
      }
    };

    const runningProcess = runManagedProcess({ request, settings, ledger, managed, onSettled });

    yield* FiberSet.run(fibers, runningProcess);
    yield* Deferred.await(managed.ready);

    return observeProcess({ managed });
  });

  /** Absence means no start was accepted under this process identity. */
  const readyProcess = Effect.fn('readyProcess')(function* ({
    processId,
  }: ProcessIdInput): Effect.fn.Return<Option.Option<ManagedProcess>> {
    const existing = processes.get(processId);
    const managed = Option.fromNullishOr(existing);

    if (Option.isSome(managed)) {
      yield* Deferred.await(managed.value.ready);
    }

    return managed;
  });

  const read = Effect.fn('read')(function* ({
    processId,
  }: ProcessIdInput): Effect.fn.Return<Option.Option<ProcessObservation>> {
    const managed = yield* readyProcess({ processId });

    if (Option.isNone(managed)) {
      return Option.none();
    }

    const observation = observeProcess({ managed: managed.value });

    return Option.some(observation);
  });

  const stop = Effect.fn('stop')(function* ({
    processId,
  }: ProcessIdInput): Effect.fn.Return<Option.Option<ProcessObservation>, ProcessFailed> {
    const managed = yield* readyProcess({ processId });

    if (Option.isNone(managed)) {
      return Option.none();
    }

    const current = MutableRef.get(managed.value.state);

    if (Option.isSome(current.run)) {
      MutableRef.set(managed.value.state, { ...current, isStopRequested: true });
      yield* current.run.value.kill;
      yield* Deferred.await(managed.value.settled).pipe(
        Effect.timeoutOrElse({
          duration: STOP_TIMEOUT,
          orElse: () => new ProcessFailed({ processId, reason: 'managed process did not stop before its deadline' }),
        }),
      );
    }

    const observation = observeProcess({ managed: managed.value });

    return Option.some(observation);
  });

  return { start, read, stop, list, ownedProcessGroups };
}

type DiscardProcessOutputInput = { readonly managed: ManagedProcess };

function discardProcessOutput({ managed }: DiscardProcessOutputInput): void {
  const current = MutableRef.get(managed.state);
  const output = current.readOutput();
  const textBytes = Buffer.byteLength(output.text);
  const omittedBytes = Bytes.make(output.omittedBytes + textBytes);

  MutableRef.set(managed.state, { ...current, readOutput: () => ({ text: '', omittedBytes }) });
}

type ObserveProcessInput = { readonly managed: ManagedProcess };

function observeProcess({ managed }: ObserveProcessInput): ProcessObservation {
  const state = MutableRef.get(managed.state);

  return { handle: managed.handle, state: state.outcome, output: state.readOutput() };
}
