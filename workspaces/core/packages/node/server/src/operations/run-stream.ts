import { catalog, RequestInvalid, TurnNotFound } from '@mechane/protocol';
import { HttpMethod, HttpStatusCode } from '@mechane/records';
import { requireWorkspaceMember } from '@mechane/runtime';
import type { AuthCaller, RuntimeStore } from '@mechane/runtime';
import { Record, Schema } from 'effect';
import { respondFailure } from '../http/failure.ts';

const STREAM_CURSOR_MAX_CHUNKS = 1_000_000;

const StreamQuery = Schema.Struct({
  startIndex: Schema.optionalKey(
    Schema.NumberFromString.check(Schema.isInt(), Schema.isBetween({ minimum: 0, maximum: STREAM_CURSOR_MAX_CHUNKS })),
  ),
});

type RunStreamHandlerInput = {
  readonly store: RuntimeStore;
  readonly authenticate: (request: Request, peerAddress?: string | null) => Promise<AuthCaller>;
  readonly readRunUIStream: (input: {
    readonly workspaceId: string;
    readonly runId: string;
    readonly cursor?: number;
  }) => Promise<Response>;
};

export function createRunStreamHandler({ store, authenticate, readRunUIStream }: RunStreamHandlerInput) {
  return async function runStream(request: Request, peerAddress: string | null = null): Promise<Response | null> {
    const url = new URL(request.url);
    const route = /^\/api\/v1\/workspaces\/([^/]+)\/mechs\/([^/]+)\/turns\/([^/]+)\/stream$/u.exec(url.pathname);

    if (route === null) {
      return null;
    }

    if (request.method !== HttpMethod.Get) {
      return new Response(null, { status: HttpStatusCode.MethodNotAllowed, headers: { allow: HttpMethod.Get } });
    }

    try {
      const decoded = Schema.decodeUnknownResult(catalog.showTurn.params)({
        workspace_id: route[1],
        mech_id: route[2],
        turn_id: route[3],
      });

      const query = Schema.decodeUnknownResult(StreamQuery, { onExcessProperty: 'error' })(
        Record.fromEntries(url.searchParams),
      );

      if (decoded._tag === 'Failure' || query._tag === 'Failure') {
        throw new RequestInvalid({ reason: 'The run stream request is invalid' });
      }

      const input = decoded.success;
      const caller = await authenticate(request, peerAddress);

      await requireWorkspaceMember({ store, caller, workspaceId: input.workspaceId });

      const run = await store.getRun({ workspaceId: input.workspaceId, runId: input.turnId });

      if (run === null || run.mechId !== input.mechId) {
        throw new TurnNotFound({ turnId: input.turnId });
      }

      return await readRunUIStream({
        workspaceId: input.workspaceId,
        runId: input.turnId,
        cursor: query.success.startIndex ?? 0,
      });
    } catch (failure) {
      return respondFailure({ failure, request });
    }
  };
}
