import type { ConsoleApi, Input, Output } from './api.ts';
import { readRequests } from './requests.ts';
import type { ReadRequest } from './requests.ts';

type ProcessCommand = Omit<Input<'stopEnvironmentProcess'>, 'workspaceId'>;

type CommandDependencies = {
  readonly api: ConsoleApi;
  readonly workspaceId: Input<'listMechs'>['workspaceId'];
  readonly signalForRead: (request: ReadRequest) => AbortSignal;
  readonly onFailure: (request: ReadRequest, error: unknown, signal: AbortSignal) => Promise<void>;
  readonly refreshRequest: (request: ReadRequest) => Promise<void>;
};

/** Settles each command from the API acknowledgment, then reconciles affected local reads. */
export function createCommands({ api, workspaceId, signalForRead, onFailure, refreshRequest }: CommandDependencies) {
  return {
    async stopEnvironmentProcess(input: ProcessCommand): Promise<Output<'stopEnvironmentProcess'>> {
      const request = readRequests.environment(input.mechId);

      const detailRequest = readRequests.environmentProcess(input.mechId, {
        machineId: input.machineId,
        processId: input.processId,
      });

      const commandSignal = signalForRead(request);

      try {
        const saved = await api('stopEnvironmentProcess', { ...input, workspaceId }, commandSignal);

        void Promise.allSettled([refreshRequest(request), refreshRequest(detailRequest)]);

        return saved;
      } catch (error) {
        void Promise.allSettled([
          onFailure(request, error, commandSignal),
          refreshRequest(request),
          refreshRequest(detailRequest),
        ]);

        throw error;
      }
    },
  };
}
