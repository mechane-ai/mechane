import { HttpHeader, HttpMethod, HttpStatusCode, MediaType } from '@mechane/records';
import { Redacted, Result, Schema } from 'effect';
import type { ManagedExecution, ManagedRequest } from '../managed/provider-types.ts';
import { readBoundedJson } from '../tools/http.ts';
import { GatewayBearer } from './gateway-credential-settings.ts';

const assertionDeadlineMs = 10_000;
const assertionResponseBytes = 32_768;

const Assertion = Schema.Struct({
  assertion: GatewayBearer,
  reuse: Schema.optionalKey(Schema.Literals(['session', 'deployment'])),
});

const MIN_GATEWAY_TOKEN_LIFETIME_SECONDS = 90;
const MILLISECONDS_PER_SECOND = 1000;

const jwtHeader = Schema.StringFromBase64Url.pipe(
  Schema.decodeTo(Schema.fromJsonString(Schema.Struct({ alg: Schema.NonEmptyString }))),
);

const jwtClaims = Schema.StringFromBase64Url.pipe(
  Schema.decodeTo(Schema.fromJsonString(Schema.Struct({ exp: Schema.optionalKey(Schema.Number) }))),
);

function hasSufficientLifetime(assertion: string): boolean {
  const [header, payload, signature, extra] = assertion.split('.');

  if (header === undefined || payload === undefined) {
    return true;
  }

  const isCompact = signature !== undefined && extra === undefined;

  if (!isCompact || Result.isFailure(Schema.decodeUnknownResult(jwtHeader)(header))) {
    return true;
  }

  const { exp } = Schema.decodeUnknownSync(jwtClaims)(payload);

  return exp === undefined || exp >= Date.now() / MILLISECONDS_PER_SECOND + MIN_GATEWAY_TOKEN_LIFETIME_SECONDS;
}

type CredentialRequest = Pick<ManagedRequest, 'configuration' | 'workspaceId' | 'withControl'> & {
  readonly execution: Pick<ManagedExecution, 'runtimeMechId' | 'sessionId'>;
  readonly signal?: AbortSignal | undefined;
};

export async function resolveGatewayCredential({
  configuration,
  workspaceId,
  withControl,
  execution,
  signal,
}: CredentialRequest): Promise<string> {
  const settings = configuration.model.credentials;

  if (settings.type === 'static') {
    return Redacted.value(settings.apiKey);
  }

  try {
    const identity = await withControl((store) =>
      store.managed.sessions.assertionContext({
        workspaceId,
        id: execution.sessionId,
        runtimeMechId: execution.runtimeMechId,
        forwardMetadata: settings.forwardMetadata,
      }),
    );

    const signals = [AbortSignal.timeout(assertionDeadlineMs)];

    if (signal !== undefined) {
      signals.push(signal);
    }

    const response = await fetch(settings.url, {
      method: HttpMethod.Post,
      redirect: 'manual',
      signal: AbortSignal.any(signals),
      headers: {
        [HttpHeader.ContentType]: MediaType.Json,
        [HttpHeader.Authorization]: `Bearer ${Redacted.value(settings.bearer)}`,
      },
      body: JSON.stringify({
        version: 1,
        purpose: 'inference',
        ...identity,
        request_id: `req_${crypto.randomUUID().replaceAll('-', '')}`,
      }),
    });

    if (response.status !== HttpStatusCode.Ok) {
      await response.body?.cancel();

      throw new Error('Invalid assertion response');
    }

    const value = await readBoundedJson(response, assertionResponseBytes);

    if (Schema.is(Assertion)(value) && hasSufficientLifetime(value.assertion)) {
      return value.assertion;
    }
  } catch {
    signal?.throwIfAborted();
  }

  throw new Error('Model gateway credential supplier failed');
}
