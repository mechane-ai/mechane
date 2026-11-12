import type { CommandResult, RunFailure, RunInput } from '@mechane/cli-kernel';
import { SandboxAction } from '@mechane/protocol';
import type { SandboxReport } from '@mechane/protocol';
import { DateTime, Duration, Effect, Option } from 'effect';
import { withWorkspace } from '../mechs/with-workspace.ts';

/** Inspection shows current and desired images without waking a suspended workspace. */
export const runSandboxShow = Effect.fn('runSandboxShow')(function* ({
  call,
  origin,
  input,
  credentials,
  selectedWorkspaceId,
}: RunInput<'sandbox show'>): Effect.fn.Return<CommandResult<'sandbox show'>, RunFailure> {
  const request = { action: SandboxAction.Show, operationId: Option.none() };

  const result = yield* withWorkspace({
    call,
    origin,
    credentials,
    selectedWorkspaceId,
    use: ({ token, workspaceId }) =>
      call({ name: 'manageSandbox', credential: token, input: { ...request, workspaceId, mechId: input.mechId } }),
  });

  const lines = sandboxLines(result);

  return { lines, result };
});

function sandboxLines({
  provider,
  status,
  image,
  desiredImage,
  operationId,
  phase,
  environment,
}: SandboxReport): ReadonlyArray<string> {
  const currentImage = Option.getOrElse(image, () => 'none');
  const operation = Option.getOrElse(operationId, () => 'none');

  const processCount = Option.match(environment.processes, {
    onNone: () => 'unavailable',
    onSome: (items) => String(items.length),
  });

  const processTime = Option.match(environment.processesObservedAt, {
    onNone: () => 'not recorded',
    onSome: DateTime.formatIso,
  });

  const startup = Option.toArray(environment.startup).flatMap(
    ({ machineId, progress, deadlineAt, guest, restoration }) => [
      `startup: ${progress.phase}; machine: ${machineId}`,
      `startup started: ${DateTime.formatIso(progress.startedAt)}; deadline: ${DateTime.formatIso(deadlineAt)}`,
      `last progress: ${DateTime.formatIso(progress.updatedAt)}`,
      ...Option.toArray(progress.failure).map((failure) => `startup failure: ${failure}`),
      ...Option.toArray(guest).flatMap((value) =>
        value.bootstrap.steps.map((step) => {
          const tool = Option.getOrElse(step.tool, () => 'guest');
          const milliseconds = Option.map(step.duration, Duration.toMillis);
          const measured = Option.match(milliseconds, { onNone: () => 'unavailable', onSome: String });

          return `${step.phase}: ${tool}; measured ms: ${measured}`;
        }),
      ),
      ...Option.toArray(restoration).map(
        (value) => `restore: ${value.copiedParts}/${value.parts} parts; ${value.bytes} archive bytes`,
      ),
    ],
  );

  return [
    `${provider}: ${status}`,
    `image: ${currentImage}; desired: ${desiredImage}`,
    `operation: ${operation} (${phase})`,
    `recorded processes: ${processCount}; observed: ${processTime}`,
    ...startup,
    ...Option.toArray(environment.lastStartupFailure).map(
      (value) => `last startup issue: ${value.code}; machine: ${value.machineId}; ${DateTime.formatIso(value.at)}`,
    ),
    ...Option.toArray(environment.execution).flatMap((execution) => {
      const dispatched = Option.match(execution.dispatchedAt, {
        onNone: () => 'not dispatched',
        onSome: DateTime.formatIso,
      });

      const settled = Option.match(execution.settledAt, {
        onNone: () => 'no terminal receipt',
        onSome: DateTime.formatIso,
      });

      const milliseconds = Option.map(execution.duration, Duration.toMillis);
      const measured = Option.match(milliseconds, { onNone: () => 'unavailable', onSome: String });

      return [
        `latest command: ${execution.executionId}; claimed: ${DateTime.formatIso(execution.claimedAt)}`,
        `command dispatched: ${dispatched}; receipt stored: ${settled}; execution ms: ${measured}`,
      ];
    }),
    'retention: files remain until explicit deletion',
  ];
}
