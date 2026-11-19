import { HttpHeader, HttpMethod, HttpStatusCode } from '@mechane/records';
import { Option } from 'effect';
import { build } from 'esbuild';
import { exportJWK, generateKeyPair, SignJWT } from 'jose';
import { convertV4MiniflareOptions, Miniflare } from 'miniflare';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const AUDIENCE = 'factory';
const SUBJECT = 'service:maintenance';
const ALGORITHM = 'ES256';

const DIRECT = 'https://identity.example.test/direct';
const REDIRECT_ISSUER = 'https://identity.example.test/redirect-issuer';
const REDIRECT_KEYS = 'https://identity.example.test/redirect-keys';
const DESTINATION = 'https://identity.example.test/destination';
const DISCOVERY = '.well-known/openid-configuration';

type IssuerInput = { readonly issuer: string };
type AddressInput = { readonly issuer: string; readonly path: string };

function address({ issuer, path }: AddressInput): string {
  const url = new URL(issuer);

  url.pathname += '/';

  return new URL(path, url).href;
}

void test('workerd discovers signing keys and never follows issuer or JWKS redirects', async (context) => {
  const sourceUrl = new URL('../src/oidc/verification.ts', import.meta.url);
  const source = fileURLToPath(sourceUrl.href);

  const bundle = await build({
    entryPoints: [source],
    bundle: true,
    format: 'esm',
    platform: 'browser',
    conditions: ['workerd', 'worker', 'browser'],
    write: false,
  });

  const verifier = Option.fromNullishOr(bundle.outputFiles[0]);
  const built = Option.isSome(verifier);

  assert.ok(built);

  const keys = await generateKeyPair(ALGORITHM);
  const publicKey = await exportJWK(keys.publicKey);
  const jwks = { keys: [{ ...publicKey, alg: ALGORITHM, kid: 'fixture' }] };
  const requests: Array<string> = [];

  const directMetadata = address({ issuer: DIRECT, path: DISCOVERY });
  const directKeys = address({ issuer: DIRECT, path: 'keys' });
  const redirectMetadata = address({ issuer: REDIRECT_ISSUER, path: DISCOVERY });
  const redirectKeysMetadata = address({ issuer: REDIRECT_KEYS, path: DISCOVERY });
  const redirectKeys = address({ issuer: REDIRECT_KEYS, path: 'keys' });

  function redirect(): Response {
    return Response.redirect(DESTINATION, HttpStatusCode.Found);
  }

  const sources = new Map<string, () => Response>([
    [directMetadata, (): Response => Response.json({ issuer: DIRECT, jwks_uri: directKeys })],
    [directKeys, (): Response => Response.json(jwks)],
    [redirectMetadata, redirect],
    [redirectKeysMetadata, (): Response => Response.json({ issuer: REDIRECT_KEYS, jwks_uri: redirectKeys })],
    [redirectKeys, redirect],
  ]);

  const options = convertV4MiniflareOptions({
    cf: {},
    compatibilityDate: '2026-10-01',
    modules: [
      {
        type: 'ESModule',
        path: 'worker.mjs',
        contents: `import { verifyOidcToken } from './verification.mjs';
          export default { async fetch(request) {
            const issuer = new URL(request.url).searchParams.get('issuer');
            try {
              const {claims} = await verifyOidcToken({token: await request.text(),
                issuers: [{name:'fixture', issuer_url:issuer, audiences:['factory']}]});
              return new Response(claims.sub);
            } catch (error) { return new Response(error.message, {status:error.status}); }
          }};`,
      },
      { type: 'ESModule', path: 'verification.mjs', contents: verifier.value.text },
    ],
    outboundService: (request) => {
      const authorization = request.headers.get(HttpHeader.Authorization);

      assert.equal(authorization, null);
      requests.push(request.url);

      const route = sources.get(request.url);
      const registered = Option.fromNullishOr(route);

      if (Option.isNone(registered)) {
        return new Response(null, { status: HttpStatusCode.NotFound });
      }

      return registered.value();
    },
  });

  const runtime = new Miniflare(options);

  context.after(async () => await runtime.dispose());

  async function verify({ issuer }: IssuerInput): Promise<void> {
    const token = await new SignJWT({})
      .setProtectedHeader({ alg: ALGORITHM, kid: 'fixture' })
      .setIssuer(issuer)
      .setAudience(AUDIENCE)
      .setSubject(SUBJECT)
      .setExpirationTime('5m')
      .sign(keys.privateKey);

    const url = new URL('https://worker.example.test');

    url.searchParams.set('issuer', issuer);

    const response = await runtime.dispatchFetch(url.href, { method: HttpMethod.Post, body: token });
    const value = await response.text();

    if (issuer === DIRECT) {
      assert.equal(response.status, HttpStatusCode.Ok);
      assert.equal(value, SUBJECT);
    } else {
      assert.equal(response.status, HttpStatusCode.Unavailable);
      assert.equal(value, 'OpenID Connect signing keys are unavailable');
    }
  }

  await verify({ issuer: DIRECT });
  await verify({ issuer: REDIRECT_ISSUER });
  await verify({ issuer: REDIRECT_KEYS });

  assert.deepEqual(requests, [directMetadata, directKeys, redirectMetadata, redirectKeysMetadata, redirectKeys]);
});
