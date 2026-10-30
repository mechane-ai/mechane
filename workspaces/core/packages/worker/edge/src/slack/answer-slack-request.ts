import type { WorkerSettings } from '@mechane/bindings';
import { resolveIntegrationSecret, SlackEnvelopeType } from '@mechane/integrations';
import { DurableObjectClass, ObjectUnavailable } from '@mechane/protocol';
import type { RequestInvalid, SlackInstallation } from '@mechane/protocol';
import { HttpStatusCode } from '@mechane/records';
import { Effect, Option, Result } from 'effect';
import type { Redacted } from 'effect';
import { admitSlackMessage } from './admit-slack-message.ts';
import { readSignedSlackEnvelope } from './read-signed-slack-envelope.ts';

type AnswerSlackRequestInput = {
  readonly request: Request;
  readonly settings: WorkerSettings;
  readonly installation: SlackInstallation;
};

type ReadSigningSecretInput = Pick<AnswerSlackRequestInput, 'settings' | 'installation'>;

/** Authenticates an event or URL challenge with the configured signing-secret reference. */
export const answerSlackRequest = Effect.fn('answerSlackRequest')(function* ({
  request,
  settings,
  installation,
}: AnswerSlackRequestInput): Effect.fn.Return<Response, RequestInvalid | ObjectUnavailable> {
  const signingSecret = yield* readSigningSecret({ settings, installation });

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

const readSigningSecret = Effect.fn('readSigningSecret')(function* ({
  settings,
  installation,
}: ReadSigningSecretInput): Effect.fn.Return<Option.Option<Redacted.Redacted>, ObjectUnavailable> {
  const resolved = yield* Effect.tryPromise({
    try: () =>
      resolveIntegrationSecret({
        settings,
        workspaceId: installation.workspaceId,
        secretReference: installation.signingSecretReference,
      }),
    catch: () =>
      new ObjectUnavailable({ objectClass: DurableObjectClass.Workspace, reason: 'Slack credential lookup failed' }),
  });

  if (Result.isFailure(resolved)) {
    return Option.none();
  }

  return resolved.success;
});
