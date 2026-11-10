import { ORIGIN_VARIABLE } from '@mechane/deployment';
import { SELF_TOKEN_VARIABLE } from '@mechane/protocol';
import { MechId, WorkspaceId } from '@mechane/records';
import { DateTime, Schema } from 'effect';

const SELF_TOKEN_DOMAIN = 'mechane:self-command:v1';
const SELF_TOKEN_PREFIX = 'mechane-self-v1';
const SELF_TOKEN_LIFETIME_MILLISECONDS = 900_000;
const TOKEN_PART_COUNT = 3;

const SelfScope = Schema.Struct({ workspaceId: WorkspaceId, mechId: MechId, expiresAt: Schema.Int });

export type SelfScope = typeof SelfScope.Type;

type SelfTokenOptions = {
  readonly workspaceId: string;
  readonly mechId: string;
  readonly serviceKey: string;
  readonly now?: number;
};

type SelfEnvironmentOptions = SelfTokenOptions & { readonly publicOrigin: string };
type SelfVerificationOptions = { readonly token: string; readonly serviceKey: string; readonly now?: number };

function encodeBytes(bytes: Uint8Array): string {
  const characters = Array.from(bytes, (value) => String.fromCodePoint(value)).join('');

  return btoa(characters).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

function decodeBytes(value: string): Uint8Array<ArrayBuffer> {
  const characters = atob(value.replaceAll('-', '+').replaceAll('_', '/'));

  return Uint8Array.from(characters, (character) => character.codePointAt(0) ?? 0);
}

async function selfKey(serviceKey: string): Promise<CryptoKey> {
  const encoder = new TextEncoder();

  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(serviceKey),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );

  const material = await crypto.subtle.sign('HMAC', key, encoder.encode(SELF_TOKEN_DOMAIN));

  return await crypto.subtle.importKey('raw', material, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}

async function createSelfToken({
  workspaceId,
  mechId,
  serviceKey,
  now = DateTime.nowUnsafe().epochMilliseconds,
}: SelfTokenOptions): Promise<string> {
  const encoder = new TextEncoder();

  const scope = Schema.decodeUnknownSync(SelfScope)({
    workspaceId,
    mechId,
    expiresAt: now + SELF_TOKEN_LIFETIME_MILLISECONDS,
  });

  const payload = encodeBytes(encoder.encode(JSON.stringify(scope)));
  const key = await selfKey(serviceKey);
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(`${SELF_TOKEN_PREFIX}.${payload}`));

  return `${SELF_TOKEN_PREFIX}.${payload}.${encodeBytes(new Uint8Array(signature))}`;
}

export async function verifySelfToken({
  token,
  serviceKey,
  now = DateTime.nowUnsafe().epochMilliseconds,
}: SelfVerificationOptions): Promise<SelfScope | null> {
  try {
    const parts = token.split('.');
    const [prefix, payload, signature] = parts;

    if (parts.length !== TOKEN_PART_COUNT || prefix !== SELF_TOKEN_PREFIX) {
      return null;
    }

    if (payload === undefined || signature === undefined) {
      return null;
    }

    const key = await selfKey(serviceKey);
    const encoder = new TextEncoder();

    const valid = await crypto.subtle.verify(
      'HMAC',
      key,
      decodeBytes(signature),
      encoder.encode(`${prefix}.${payload}`),
    );

    if (!valid) {
      return null;
    }

    const decoded = new TextDecoder().decode(decodeBytes(payload));
    const scope = Schema.decodeUnknownSync(Schema.fromJsonString(SelfScope), { onExcessProperty: 'error' })(decoded);

    if (scope.expiresAt <= now || scope.expiresAt > now + SELF_TOKEN_LIFETIME_MILLISECONDS) {
      return null;
    }

    return scope;
  } catch {
    return null;
  }
}

export async function createSelfEnvironment({
  publicOrigin,
  ...options
}: SelfEnvironmentOptions): Promise<Readonly<Record<string, string>>> {
  const token = await createSelfToken(options);

  return { [SELF_TOKEN_VARIABLE]: token, [ORIGIN_VARIABLE]: publicOrigin };
}
