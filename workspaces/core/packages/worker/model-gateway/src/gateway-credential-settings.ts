import { Redacted, Schema } from 'effect';

type StaticKey = { readonly type: 'static'; readonly apiKey: Redacted.Redacted };
type Assertion = { readonly type: 'assertion'; readonly url: string; readonly bearer: Redacted.Redacted };

export type GatewayCredentials = (StaticKey | Assertion) & { readonly forwardMetadata: ReadonlyArray<string> };

export const GatewayBearer = Schema.NonEmptyString.check(Schema.isPattern(/^[!-~]+$/u));

const METADATA_KEY_MAX_LENGTH = 64;
const forwardedKeys = Schema.Array(Schema.NonEmptyString.check(Schema.isMaxLength(METADATA_KEY_MAX_LENGTH)));

function token(value: unknown, name: string): Redacted.Redacted {
  if (!Schema.is(GatewayBearer)(value)) {
    throw new Error(`Supply a valid ${name} secret binding`);
  }

  return Redacted.make(value);
}

export function gatewayCredentials(environment: Readonly<Record<string, unknown>>): GatewayCredentials {
  const url = environment['MECHANE_MODEL_ASSERTION_URL'];
  const bearer = environment['MECHANE_MODEL_ASSERTION_BEARER'];
  const fields = environment['MECHANE_MODEL_ASSERTION_METADATA_KEYS'];
  const key = environment['MECHANE_MODEL_UPSTREAM_KEY'];

  if (url === undefined && bearer === undefined && fields === undefined) {
    return { type: 'static', apiKey: token(key, 'MECHANE_MODEL_UPSTREAM_KEY'), forwardMetadata: [] };
  }

  if (key !== undefined || typeof url !== 'string' || !URL.canParse(url)) {
    throw new Error('Configure either a fixed model key or an HTTPS model assertion callback');
  }

  const parsed = new URL(url);
  const hasCredentials = parsed.username !== '' || parsed.password !== '';

  const hasSuffix = url.includes('?') || url.includes('#');

  if (parsed.protocol !== 'https:' || hasCredentials || hasSuffix) {
    throw new Error('The model assertion URL must use HTTPS and omit credentials, query parameters, and fragments');
  }

  const keys = Schema.decodeUnknownSync(Schema.fromJsonString(forwardedKeys))(fields ?? '[]');

  if (new Set(keys).size !== keys.length) {
    throw new Error('Each forwarded model assertion metadata key must be unique');
  }

  return {
    type: 'assertion',
    url: parsed.href,
    bearer: token(bearer, 'MECHANE_MODEL_ASSERTION_BEARER'),
    forwardMetadata: keys,
  };
}
