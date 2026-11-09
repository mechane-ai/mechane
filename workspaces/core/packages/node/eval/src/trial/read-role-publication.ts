import type { OperationCall } from '@mechane/client';
import { ConsoleMessageRole } from '@mechane/protocol';
import type { ConsoleMessage } from '@mechane/protocol';
import type { MechId, Sequence, TurnId } from '@mechane/records';
import { Effect, Option, Stream } from 'effect';
import { EvalResponseInvalid } from '../errors.ts';
import type { EvalRunFailure, WorkspaceAccess } from '../types.ts';

type ReadRolePublicationInput = {
  readonly call: OperationCall<'listConsoleMessages'>;
  readonly access: WorkspaceAccess;
  readonly mechId: MechId;
  readonly runIds: ReadonlySet<TurnId>;
};

type ReadPublicationPageInput = Omit<ReadRolePublicationInput, 'runIds'> & {
  readonly beforeSequence: Option.Option<Sequence>;
};

type PublicationPage = readonly [ReadonlyArray<ConsoleMessage>, Option.Option<Option.Option<Sequence>>];

/** Public publications are separate from the activation's private final text. */
export const readRolePublication = Effect.fn('readRolePublication')(function* ({
  call,
  access,
  mechId,
  runIds,
}: ReadRolePublicationInput): Effect.fn.Return<Option.Option<ConsoleMessage>, EvalRunFailure> {
  const firstPage = Option.none<Sequence>();

  const messages = Stream.paginate(firstPage, (beforeSequence) =>
    readPublicationPage({ call, access, mechId, beforeSequence }),
  );

  const publications = Stream.filter(messages, (message) => {
    const isRoleRun = Option.exists(message.runId, (runId) => runIds.has(runId));

    return message.role === ConsoleMessageRole.Assistant && isRoleRun;
  });

  return yield* Stream.runFold(publications, Option.none<ConsoleMessage>, (latest, message) => {
    if (Option.isSome(latest) && latest.value.sequence >= message.sequence) {
      return latest;
    }

    return Option.some(message);
  });
});

const readPublicationPage = Effect.fn('readPublicationPage')(function* ({
  call,
  access,
  mechId,
  beforeSequence,
}: ReadPublicationPageInput): Effect.fn.Return<PublicationPage, EvalRunFailure> {
  const { token, workspaceId } = access;
  const afterSequence = Option.none<Sequence>();

  const page = yield* call({
    name: 'listConsoleMessages',
    input: { workspaceId, mechId, beforeSequence, afterSequence },
    credential: token,
  });

  if (!page.hasMore) {
    return [page.messages, Option.none()];
  }

  const next = page.beforeSequence;

  const hasAdvanced = Option.exists(
    next,
    (sequence) => Option.isNone(beforeSequence) || sequence < beforeSequence.value,
  );

  if (!hasAdvanced) {
    const failure = new EvalResponseInvalid({ mechId, reason: 'The Console page has no advancing publication cursor' });

    return yield* failure;
  }

  return [page.messages, Option.some(next)];
});
