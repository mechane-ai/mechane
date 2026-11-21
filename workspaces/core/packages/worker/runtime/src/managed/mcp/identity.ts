import { failManagedRequest } from '@mechane/model-gateway';
import { HttpStatusCode } from '@mechane/records';
import { Redacted, Schema } from 'effect';
import { randomUUID } from 'node:crypto';
import type { ManagedIdentitySettings } from './identity-settings.ts';
import { identityHttpsUrl } from './identity-settings.ts';

const MILLISECONDS_PER_SECOND = 1000;
const BearerIdentity = Schema.Struct({ type: Schema.Literal('agent_token'), audience: Schema.NonEmptyString });
const AdditionalIdentity = Schema.Struct({ audience: Schema.NonEmptyString });
const decodeBearer = Schema.decodeUnknownResult(BearerIdentity, { onExcessProperty: 'error' });
const decodeAdditional = Schema.decodeUnknownResult(AdditionalIdentity, { onExcessProperty: 'error' });

type IdentityHeader = 'Authorization' | 'Agent-Identity-Token';

type IdentityRequest = {
  readonly configuration: ManagedIdentitySettings | null;
  readonly server: Readonly<Record<string, unknown>>;
};

type TokenScope = {
  readonly agentId: string;
  readonly actor?: { readonly issuer: string; readonly subject: string } | undefined;
};

type Receiver = {
  readonly header: IdentityHeader;
  readonly audience: string;
  readonly configuration: ManagedIdentitySettings;
};

function invalidIdentity(): never {
  return failManagedRequest(
    HttpStatusCode.BadRequest,
    'The requested MCP agent identity is unavailable for this server',
  );
}

function prefixAllows(url: URL, prefix: string): boolean {
  const allowed = identityHttpsUrl(prefix);

  if (url.origin !== allowed.origin) {
    return false;
  }

  if (url.pathname === allowed.pathname) {
    return true;
  }

  const path = allowed.pathname.replace(/\/$/u, '');

  return url.pathname.startsWith(path) && url.pathname.charAt(path.length) === '/';
}

type IdentityDeclaration = { readonly header: IdentityHeader; readonly audience: string };

function identityDeclaration(auth: unknown, additional: unknown): IdentityDeclaration | null {
  if (auth === undefined) {
    const decoded = decodeAdditional(additional);

    if (decoded._tag !== 'Success') {
      return null;
    }

    return { header: 'Agent-Identity-Token', audience: decoded.success.audience };
  }

  const decoded = decodeBearer(auth);

  if (decoded._tag !== 'Success') {
    return null;
  }

  return { header: 'Authorization', audience: decoded.success.audience };
}

function identityActor(actor: TokenScope['actor'], includeActor: boolean): Readonly<Record<string, string>> {
  if (!includeActor || actor === undefined) {
    return {};
  }

  return { actor_iss: actor.issuer, actor_sub: actor.subject };
}

function receiver({ configuration, server }: IdentityRequest): Receiver | null {
  const auth = server['auth'];
  const additional = server['agent_token_header'];

  if (auth === undefined && additional === undefined) {
    return null;
  }

  if (configuration === null || (auth !== undefined && additional !== undefined)) {
    return invalidIdentity();
  }

  const target = server['url'];

  if (typeof target !== 'string') {
    return invalidIdentity();
  }

  const declaration = identityDeclaration(auth, additional);

  if (declaration === null) {
    return invalidIdentity();
  }

  const { audience, header } = declaration;
  const recipient = configuration.audiences.find((candidate) => candidate.audience === audience);

  if (recipient === undefined) {
    return invalidIdentity();
  }

  try {
    const url = identityHttpsUrl(target);

    if (!recipient.urls.some((prefix) => prefixAllows(url, prefix))) {
      return invalidIdentity();
    }
  } catch {
    return invalidIdentity();
  }

  return { header, audience, configuration };
}

export function validateManagedMcpIdentity(request: IdentityRequest): void {
  receiver(request);
}

function base64Url(bytes: Uint8Array): string {
  const characters = Array.from(bytes, (byte) => String.fromCodePoint(byte)).join('');

  return btoa(characters).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

function encode(value: unknown): string {
  return base64Url(new TextEncoder().encode(JSON.stringify(value)));
}

type IssuedIdentity = { readonly header: IdentityHeader; readonly value: Redacted.Redacted };

export async function issueManagedMcpIdentity(input: IdentityRequest & TokenScope): Promise<IssuedIdentity | null> {
  const target = receiver(input);

  if (target === null) {
    return null;
  }

  const { header, configuration, audience } = target;
  const now = Math.floor(Date.now() / MILLISECONDS_PER_SECOND);
  const protectedHeader = encode({ alg: 'RS256', kid: configuration.kid, typ: 'agent+jwt' });
  const actor = identityActor(input.actor, configuration.includeActor);

  const claims = encode({
    iss: configuration.issuer,
    aud: audience,
    sub: input.agentId,
    agent_id: input.agentId,
    token_use: 'agent',
    jti: randomUUID(),
    iat: now,
    exp: now + configuration.tokenLifetimeSeconds,
    ...actor,
  });

  const content = `${protectedHeader}.${claims}`;
  const pkcs8 = Redacted.value(configuration.key).export({ format: 'der', type: 'pkcs8' });

  const key = await crypto.subtle.importKey(
    'pkcs8',
    Uint8Array.from(pkcs8),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );

  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(content));
  const token = `${content}.${base64Url(new Uint8Array(signature))}`;

  if (header === 'Authorization') {
    return { header, value: Redacted.make(`Bearer ${token}`) };
  }

  return { header, value: Redacted.make(token) };
}
