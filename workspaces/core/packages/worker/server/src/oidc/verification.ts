import { HttpHeader, HttpStatusCode, MediaType } from '@mechane/records';
import { Schema } from 'effect';
import { createLocalJWKSet, decodeJwt, jwtVerify } from 'jose';
import type { JWTPayload } from 'jose';
import { ManagedHttpError } from '../managed/http-error.ts';
import { decodeOidcKeys, trustedOidcUrl } from './settings.ts';
import type { ManagedIdentityIssuer, ManagedIdentitySettings } from './settings.ts';

const ALGORITHMS: ReadonlyArray<string> = [
  'RS256',
  'RS384',
  'RS512',
  'PS256',
  'PS384',
  'PS512',
  'ES256',
  'ES384',
  'ES512',
  'EdDSA',
];

const DISCOVERY_TIMEOUT_MS = 4000;
const PUBLIC_KEY_CACHE_SECONDS = 60;
const Discovery = Schema.Struct({ issuer: Schema.String, jwks_uri: Schema.String });

type VerifyInput = { readonly token: string; readonly issuers: ManagedIdentitySettings };
type Source = { readonly url: URL; readonly signal: AbortSignal };

function refused(): ManagedHttpError {
  return new ManagedHttpError(HttpStatusCode.Unauthorized, 'Invalid or expired OpenID Connect token');
}

async function metadata({ url, signal }: Source): Promise<unknown> {
  const response = await fetch(url, {
    signal,
    redirect: 'manual',
    headers: { [HttpHeader.Accept]: MediaType.Json },
    cf: { cacheEverything: true, cacheTtlByStatus: { '200': PUBLIC_KEY_CACHE_SECONDS, '400-599': -1 } },
  });

  if (!response.ok) {
    await response.body?.cancel();

    throw new Error('Identity provider metadata is unavailable');
  }

  return await response.json();
}

async function keyAddress(issuer: ManagedIdentityIssuer, signal: AbortSignal) {
  if (issuer.jwks_uri !== undefined) {
    return trustedOidcUrl(issuer.jwks_uri);
  }

  const discoveryUrl = `${issuer.issuer_url.replace(/\/$/u, '')}/.well-known/openid-configuration`;
  const url = trustedOidcUrl(discoveryUrl);
  const raw = await metadata({ url, signal });
  const document = Schema.decodeUnknownSync(Discovery)(raw);

  if (document.issuer !== issuer.issuer_url) {
    throw new Error('Discovery metadata names a different issuer');
  }

  return trustedOidcUrl(document.jwks_uri);
}

async function keysFor(issuer: ManagedIdentityIssuer) {
  if (issuer.jwks !== undefined) {
    const keys = decodeOidcKeys(issuer.jwks);

    return createLocalJWKSet(keys);
  }

  try {
    const signal = AbortSignal.timeout(DISCOVERY_TIMEOUT_MS);
    const url = await keyAddress(issuer, signal);
    const raw = await metadata({ url, signal });
    const keys = decodeOidcKeys(raw);

    return createLocalJWKSet(keys);
  } catch {
    throw new ManagedHttpError(HttpStatusCode.Unavailable, 'OpenID Connect signing keys are unavailable');
  }
}

function readUnverifiedClaims(token: string): JWTPayload {
  try {
    return decodeJwt(token);
  } catch {
    throw refused();
  }
}

export async function verifyOidcToken({ token, issuers }: VerifyInput) {
  const claims = readUnverifiedClaims(token);
  const issuer = issuers.find((source) => source.issuer_url === claims.iss);

  if (issuer === undefined) {
    throw refused();
  }

  const keySet = await keysFor(issuer);

  try {
    const verified = await jwtVerify(token, keySet, {
      issuer: issuer.issuer_url,
      audience: [...issuer.audiences],
      algorithms: [...ALGORITHMS],
      requiredClaims: ['exp', 'aud', 'iss'],
    });

    return { issuer, claims: verified.payload };
  } catch {
    throw refused();
  }
}
