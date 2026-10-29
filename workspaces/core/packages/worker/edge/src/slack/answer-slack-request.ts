import type { WorkerSettings } from '@mechane/bindings';
import type { SlackInstallation } from '@mechane/deployment';
import { resolveIntegrationSecret, SlackEnvelopeType } from '@mechane/integrations';
import type { ObjectUnavailable, RequestInvalid } from '@mechane/protocol';
import { HttpStatusCode } from '@mechane/records';
import { Effect, Option } from 'effect';
import { admitSlackMessage } from './admit-slack-message.ts';
import { readSignedSlackEnvelope } from './read-signed-slack-envelope.ts';

type AnswerSlackRequestInput = {
  readonly request: Request;
  readonly settings: WorkerSettings;
  readonly installation: SlackInstallation;
};

/** Authenticates an event or URL challenge with the configured signing-secret reference. */
export const answerSlackRequest = Effect.fn('answerSlackRequest')(function* ({
  request,
  settings,
  installation,
}: AnswerSlackRequestInput): Effect.fn.Return<Response, RequestInvalid | ObjectUnavailable> {
  const signingSecret = resolveIntegrationSecret({
    secrets: settings.integrationSecrets,
    workspaceId: installation.workspaceId,
    secretReference: installation.signingSecretReference,
  });

  if (Option.isNone(signingSecret)) {
    return new Response(null, { status: HttpStatusCode.Unavailable });
  }

  const envelope = yield* readSignedSlackEnvelope({ request, signingSecret: signingSecret.value });

  if (Option.isNone(envelope)) {
    return new Response(null, { status: HttpStatusCode.Unauthorized });
  }

  if (envelope.value.type === SlackEnvelopeType.UrlVerification) {
    return Response.json({ challenge: envelope.value.challenge }, { status: HttpStatusCode.Ok });
  }

  const status = yield* admitSlackMessage({ settings, installation, envelope: envelope.value });

  return new Response(null, { status });
});
