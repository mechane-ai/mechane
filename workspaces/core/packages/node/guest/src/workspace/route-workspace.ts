import { decodeRequestPart } from '@mechane/protocol';
import type { RequestInvalid, RouteNotFound } from '@mechane/protocol';
import { HttpMethod, RecordId } from '@mechane/records';
import { ArchiveMode, WorkspaceArchiveRequest, WorkspaceStep } from '@mechane/sandbox-wire';
import { Effect, Schema } from 'effect';
import type { IncomingMessage } from 'node:http';
import type { WorkspaceFailed } from '../errors.ts';
import type { ServedAnswer, WorkspaceJournal } from '../types.ts';
import { readWorkspaceBody } from './read-workspace-body.ts';

type RouteWorkspaceInput = {
  readonly request: IncomingMessage;
  readonly method: string;
  readonly rest: ReadonlyArray<string>;
  readonly workspace: WorkspaceJournal;
  readonly notFound: RouteNotFound;
};

const WorkspaceRoute = Schema.Tuple([RecordId, Schema.Enum(WorkspaceStep)]);

const WorkspacePartRoute = Schema.Tuple([
  RecordId,
  Schema.Literal(WorkspaceStep.Part),
  Schema.NumberFromString.check(Schema.isInt(), Schema.isGreaterThanOrEqualTo(0)),
]);

const WorkspaceRequestRoute = Schema.Union([WorkspaceRoute, WorkspacePartRoute]);

const WORKSPACE_METHODS: Readonly<Record<WorkspaceStep, ReadonlySet<string>>> = {
  [WorkspaceStep.Archive]: new Set(),
  [WorkspaceStep.Checkpoint]: new Set([HttpMethod.Put]),
  [WorkspaceStep.Restore]: new Set([HttpMethod.Put]),
  [WorkspaceStep.Release]: new Set([HttpMethod.Delete]),
  [WorkspaceStep.Part]: new Set([HttpMethod.Get, HttpMethod.Put]),
};

/** Decodes a generation route and admits only the method allowed for that workspace step. */
export const routeWorkspace = Effect.fn('routeWorkspace')(function* ({
  request,
  method,
  rest,
  workspace,
  notFound,
}: RouteWorkspaceInput): Effect.fn.Return<ServedAnswer, RouteNotFound | RequestInvalid | WorkspaceFailed> {
  const route = yield* decodeRequestPart({ schema: WorkspaceRequestRoute, value: rest });
  const [generation, step, part = 0] = route;

  if (!WORKSPACE_METHODS[step].has(method)) {
    return yield* notFound;
  }

  if (step === WorkspaceStep.Checkpoint) {
    const body = yield* readWorkspaceBody({ generation, step, part, request, archiveMode: ArchiveMode.Snapshot });
    const schema = Schema.fromJsonString(WorkspaceArchiveRequest);
    const value = body.toString('utf8');
    const archive = yield* decodeRequestPart({ schema, value });

    return yield* workspace.answer({ generation, step, part, request, archiveMode: archive.mode });
  }

  return yield* workspace.answer({ generation, step, part, request, archiveMode: ArchiveMode.Snapshot });
});
