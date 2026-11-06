import type { Mech } from '@mechane/protocol';
import { isRevisionConflict } from './api.ts';
import type { ConsoleApi, Input, Output } from './api.ts';
import { readRequests } from './requests.ts';
import type { ReadKind, ReadRequest } from './requests.ts';

type CommandInput<Name extends 'createMech' | 'updateMech' | 'sendInboxItem' | 'cancelTurn'> = Omit<
  Input<Name>,
  'workspaceId'
>;

type CommandDependencies = {
  readonly api: ConsoleApi;
  readonly workspaceId: Input<'listMechs'>['workspaceId'];
  readonly signal: AbortSignal;
  readonly saveMech: (mech: Mech, signal: AbortSignal) => Promise<void>;
  readonly signalForRead: (request: ReadRequest) => AbortSignal;
  readonly onFailure: (request: ReadRequest, error: unknown, signal: AbortSignal) => Promise<void>;
  readonly reportLocalFailure: (error: unknown) => void;
  readonly refreshRequest: (request: ReadRequest) => Promise<void>;
  readonly refreshKind: (kind: ReadKind, mechId?: string) => Promise<void>;
};

/** Settles each command from the API acknowledgment, then reconciles affected local reads. */
export function createCommands({
  api,
  workspaceId,
  signal,
  saveMech,
  signalForRead,
  onFailure,
  reportLocalFailure,
  refreshRequest,
  refreshKind,
}: CommandDependencies) {
  async function retainMech(mech: Mech, writeSignal: AbortSignal): Promise<void> {
    function isCurrent(): boolean {
      return !writeSignal.aborted;
    }

    if (!isCurrent()) {
      return;
    }

    try {
      await saveMech(mech, writeSignal);
    } catch (error) {
      if (isCurrent()) {
        reportLocalFailure(error);
      }
    }
  }

  async function refreshMech(mechId: string): Promise<void> {
    await Promise.allSettled([refreshRequest(readRequests.mech(mechId)), refreshKind('mechs')]);
  }

  async function reconcileMech(mech: Mech, writeSignal: AbortSignal): Promise<void> {
    await retainMech(mech, writeSignal);
    await refreshMech(mech.id);
  }

  async function refreshActivity(mechId: string): Promise<void> {
    await Promise.allSettled([
      refreshRequest(readRequests.events(mechId, null)),
      refreshRequest(readRequests.turns(mechId, null)),
      refreshRequest(readRequests.mech(mechId)),
      refreshKind('turnEvents', mechId),
    ]);
  }

  return {
    async createMech(input: CommandInput<'createMech'>): Promise<Mech> {
      const saved = await api('createMech', { ...input, workspaceId }, signal);

      void reconcileMech(saved, signalForRead(readRequests.mech(saved.id)));

      return saved;
    },
    async updateMech(input: CommandInput<'updateMech'>): Promise<Mech> {
      const request = readRequests.mech(input.mechId);
      const commandSignal = signalForRead(request);

      try {
        const saved = await api('updateMech', { ...input, workspaceId }, commandSignal);

        void reconcileMech(saved, commandSignal);

        return saved;
      } catch (error) {
        void Promise.allSettled([onFailure(request, error, commandSignal)]);

        if (isRevisionConflict(error)) {
          void Promise.allSettled([refreshRequest(readRequests.mech(input.mechId))]);
        }

        throw error;
      }
    },
    async sendInboxItem(input: CommandInput<'sendInboxItem'>): Promise<Output<'sendInboxItem'>> {
      const request = readRequests.mech(input.mechId);
      const commandSignal = signalForRead(request);

      try {
        const saved = await api('sendInboxItem', { ...input, workspaceId }, commandSignal);

        void refreshActivity(input.mechId);

        return saved;
      } catch (error) {
        void Promise.allSettled([onFailure(request, error, commandSignal)]);

        throw error;
      }
    },
    async cancelTurn(input: CommandInput<'cancelTurn'>): Promise<Output<'cancelTurn'>> {
      const request = readRequests.trace(input.mechId, input.turnId);
      const commandSignal = signalForRead(request);

      try {
        const saved = await api('cancelTurn', { ...input, workspaceId }, commandSignal);

        void refreshActivity(input.mechId);
        void Promise.allSettled([refreshRequest(request)]);

        return saved;
      } catch (error) {
        void Promise.allSettled([onFailure(request, error, commandSignal)]);

        throw error;
      }
    },
  };
}
