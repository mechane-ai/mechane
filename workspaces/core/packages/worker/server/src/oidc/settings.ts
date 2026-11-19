import { Schema } from 'effect';
import type { JSONWebKeySet } from 'jose';
import { jsonSetting } from '../settings/environment.ts';
import type { SettingsEnvironment } from '../settings/environment.ts';

const Role = Schema.Literals(['admin', 'developer', 'user']);
const Rule = Schema.Struct({ group: Schema.NonEmptyString, role: Role });

const PublicKey = Schema.StructWithRest(
  Schema.Struct({
    kty: Schema.Literals(['RSA', 'EC', 'OKP']),
    key_ops: Schema.optionalKey(Schema.Array(Schema.String)),
  }),
  [Schema.Record(Schema.String, Schema.Unknown)],
);

const KeySet = Schema.Struct({ keys: Schema.NonEmptyArray(PublicKey) });

const Issuer = Schema.Struct({
  name: Schema.NonEmptyString,
  issuer_url: Schema.NonEmptyString,
  audiences: Schema.NonEmptyArray(Schema.NonEmptyString),
  roles: Schema.optionalKey(Schema.Array(Rule)),
  default_role: Schema.optionalKey(Role),
  subject_claim: Schema.optionalKey(Schema.NonEmptyString),
  stable_subject: Schema.optionalKey(Schema.Boolean),
  groups_claim: Schema.optionalKey(Schema.NonEmptyString),
  jwks_uri: Schema.optionalKey(Schema.NonEmptyString),
  jwks: Schema.optionalKey(KeySet),
});

type IssuerInput = typeof Issuer.Type;
export type ManagedIdentityIssuer = IssuerInput;
export type ManagedIdentitySettings = ReadonlyArray<ManagedIdentityIssuer>;

export function trustedOidcUrl(input: string): URL {
  const url = new URL(input);

  const hasCredentials = url.username !== '' || url.password !== '';

  if (url.protocol !== 'https:' || hasCredentials || url.hash !== '') {
    throw new Error('OIDC keys and issuer metadata require an HTTPS URL without credentials or fragments');
  }

  return url;
}

export function decodeOidcKeys(value: unknown): JSONWebKeySet {
  const fields = Schema.decodeUnknownSync(KeySet)(value);

  const keys = fields.keys.map(({ key_ops, ...key }) => {
    if (Object.hasOwn(key, 'd') || Object.hasOwn(key, 'k')) {
      throw new Error('OIDC verification accepts public keys only');
    }

    if (key_ops === undefined) {
      return key;
    }

    return { ...key, key_ops: [...key_ops] };
  });

  return { keys };
}

export function loadManagedIdentitySettings(environment: SettingsEnvironment): ManagedIdentitySettings {
  const value = jsonSetting({ name: 'MECHANE_OIDC_ISSUERS', environment, fallback: '[]' });
  const settings = Schema.decodeUnknownSync(Schema.Array(Issuer), { onExcessProperty: 'error' })(value);
  const names = new Set<string>();
  const urls = new Set<string>();

  for (const issuer of settings) {
    const url = trustedOidcUrl(issuer.issuer_url);

    if (url.search !== '' || names.has(issuer.name) || urls.has(issuer.issuer_url)) {
      throw new Error('Each OIDC issuer requires a distinct name and URL without a query');
    }

    if ((issuer.roles?.length ?? 0) === 0 && issuer.default_role === undefined) {
      throw new Error('An OIDC issuer needs a role mapping or a default role');
    }

    if (issuer.jwks_uri !== undefined) {
      trustedOidcUrl(issuer.jwks_uri);

      if (issuer.jwks !== undefined) {
        throw new Error('An OIDC issuer must select only one key source');
      }
    }

    if (issuer.jwks !== undefined) {
      decodeOidcKeys(issuer.jwks);
    }

    names.add(issuer.name);
    urls.add(issuer.issuer_url);
  }

  return settings;
}
