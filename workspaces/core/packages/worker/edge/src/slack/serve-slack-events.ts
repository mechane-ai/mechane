import type { WorkerSettings } from '@mechane/bindings';
import { findSlackInstallation } from '@mechane/integrations';
import { RequestInvalid } from '@mechane/protocol';
import type { ObjectUnavailable } from '@mechane/protocol';
import { HttpMethod, HttpStatusCode, SlackConnectionId, WorkspaceId } from '@mechane/records';
import { Effect, Option, Record, Schema } from 'effect';
import { matchPath } from '../routing/match-path.ts';
import { answerSlackRequest } from './answer-slack-request.ts';

const SlackEventRoute = Schema.Struct({ workspace_id: WorkspaceId, connection_id: SlackConnectionId });

type SlackEventRoute = typeof SlackEventRoute.Type;

type ServeSlackEventsInput = { readonly request: Request; readonly url: URL; readonly settings: WorkerSettings };

/** Routes signed Slack events outside the bearer-authenticated operation catalog. */
export const serveSlackEvents = Effect.fn('serveSlackEvents')(function* ({
  request,
  url,
  settings,
}: ServeSlackEventsInput): Effect.fn.Return<Option.Option<Response>, RequestInvalid | ObjectUnavailable> {
  const path = matchPath({
    pattern: '/integrations/slack/:workspace_id/:connection_id/events',
    pathname: url.pathname,
  });

  if (request.method !== HttpMethod.Post || Option.isNone(path)) {
    return Option.none();
  }

  const params = yield* Effect.try({
    try: () => Record.map(path.value, decodeURIComponent),
    catch: () => new RequestInvalid({ reason: 'Slack route contains invalid percent-encoding' }),
  });

  const route = yield* Schema.decodeUnknownEffect(SlackEventRoute)(params).pipe(
    Effect.mapError(() => new RequestInvalid({ reason: 'Slack route is invalid' })),
  );

  const workspaceId = route.workspace_id;
  const connectionId = route.connection_id;

  const installation = findSlackInstallation({ installations: settings.slackInstallations, workspaceId, connectionId });

  if (Option.isNone(installation)) {
    const response = new Response(null, { status: HttpStatusCode.NotFound });

    return Option.some(response);
  }

  const response = yield* answerSlackRequest({ request, settings, installation: installation.value });

  return Option.some(response);
});
