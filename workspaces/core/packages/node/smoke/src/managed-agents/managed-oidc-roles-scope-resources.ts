import Anthropic from '@anthropic-ai/sdk';
import { HttpStatusCode } from '@mechane/records';
import type { ScenarioInput } from '@mechane/testing';
import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { generateKeyPairSync, randomUUID, sign } from 'node:crypto';
import type { KeyObject } from 'node:crypto';

const ISSUER = 'https://auth.example.test/managed';
const TOKEN_LIFETIME_SECONDS = 300;
const MILLISECONDS_PER_SECOND = 1000;
const AUDIENCE = 'mechane-test';
const ALG = 'ES256';

type FixtureIdentity = {
  readonly subject: string;
  readonly groups: ReadonlyArray<string>;
  readonly audience?: string;
  readonly exp?: number;
  readonly issuer?: string;
};

type Credentials = { readonly baseURL: string; readonly privateKey: KeyObject; readonly identity: FixtureIdentity };

function jwtPart(value: unknown): string {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

function oidcClient({ baseURL, privateKey, identity }: Credentials) {
  const header = jwtPart({ alg: ALG, kid: 'fixture' });

  const body = jwtPart({
    iss: identity.issuer ?? ISSUER,
    aud: identity.audience ?? AUDIENCE,
    sub: identity.subject,
    exp: identity.exp ?? Math.floor(Date.now() / MILLISECONDS_PER_SECOND) + TOKEN_LIFETIME_SECONDS,
    groups: identity.groups,
  });

  const content = `${header}.${body}`;
  const signature = sign('sha256', Buffer.from(content), { key: privateKey, dsaEncoding: 'ieee-p1363' });
  const token = `${content}.${signature.toString('base64url')}`;

  return new Anthropic({ authToken: token, baseURL, maxRetries: 0 });
}

export async function managedOidcRolesScopeResources({ stack }: ScenarioInput): Promise<void> {
  const keys = generateKeyPairSync('ec', { namedCurve: 'P-256' });
  const foreignKeys = generateKeyPairSync('ec', { namedCurve: 'P-256' });
  const publicKey = keys.publicKey.export({ format: 'jwk' });

  const settings = [
    {
      name: 'staff',
      issuer_url: ISSUER,
      audiences: [AUDIENCE],
      roles: [
        { group: 'ops', role: 'admin' },
        { group: 'eng-?', role: 'developer' },
      ],
      jwks: { keys: [{ ...publicKey, alg: ALG, kid: 'fixture' }] },
    },
  ];

  const baseURL = stack.origin.origin;
  const privateKey = keys.privateKey;
  const identity = { subject: 'alice', groups: ['eng-a'] };
  const alice = oidcClient({ baseURL, privateKey, identity });
  const bob = oidcClient({ baseURL, privateKey, identity: { subject: 'bob', groups: ['eng-b'] } });
  const admin = oidcClient({ baseURL, privateKey, identity: { subject: 'operator', groups: ['eng-a', 'ops'] } });

  const key = randomUUID();
  const deployment = new Anthropic({ baseURL, apiKey: key, maxRetries: 0 });
  const environment = { MECHANE_OIDC_ISSUERS: JSON.stringify(settings), MECHANE_SERVER_API_KEY: key };

  await stack.restart({ environment });

  try {
    const bootstrap = await deployment.beta.agents.create({ name: randomUUID(), model: 'claude-haiku-5-5' });

    await assert.rejects(alice.beta.agents.retrieve(bootstrap.id), { status: HttpStatusCode.NotFound });

    const agent = await alice.beta.agents.create({ name: randomUUID(), model: 'claude-haiku-5-5' });
    const fetched = await alice.beta.agents.retrieve(agent.id);

    assert.equal(fetched.id, agent.id);
    await assert.rejects(bob.beta.agents.retrieve(agent.id), { status: HttpStatusCode.NotFound });

    const visible = await bob.beta.agents.list();

    assert.equal(
      visible.data.some((entry) => entry.id === agent.id),
      false,
    );

    const adminView = await admin.beta.agents.retrieve(agent.id);

    assert.equal(adminView.id, agent.id);

    const sharedEnvironment = await admin.beta.environments.create({
      name: randomUUID(),
      config: { type: 'self_hosted' },
    });

    const shared = await bob.beta.environments.retrieve(sharedEnvironment.id);

    assert.equal(shared.id, sharedEnvironment.id);
    await assert.rejects(bob.beta.environments.create({ name: randomUUID(), config: { type: 'self_hosted' } }), {
      status: HttpStatusCode.Forbidden,
    });

    const noRole = oidcClient({ baseURL, privateKey, identity: { ...identity, groups: ['eng-abc'] } });

    await assert.rejects(noRole.beta.agents.list(), { status: HttpStatusCode.Forbidden });

    for (const invalid of [
      { ...identity, exp: 1 },
      { ...identity, audience: 'another-service' },
      { ...identity, issuer: 'https://other.example.test' },
    ]) {
      const client = oidcClient({ baseURL, privateKey, identity: invalid });

      await assert.rejects(client.beta.agents.list(), { status: HttpStatusCode.Unauthorized });
    }

    const unsignedByOurIssuer = oidcClient({ baseURL, privateKey: foreignKeys.privateKey, identity });

    await assert.rejects(unsignedByOurIssuer.beta.agents.list(), { status: HttpStatusCode.Unauthorized });
    await stack.restart({ environment: { ...environment, MECHANE_REFUSE_SERVER_API_KEY: 'true' } });
    await assert.rejects(deployment.beta.agents.list(), { status: HttpStatusCode.Unauthorized });

    const retained = await admin.beta.agents.retrieve(bootstrap.id);

    assert.equal(retained.id, bootstrap.id);
  } finally {
    await stack.restart({
      environment: { MECHANE_OIDC_ISSUERS: null, MECHANE_REFUSE_SERVER_API_KEY: null, MECHANE_SERVER_API_KEY: null },
    });
  }

  await assert.rejects(alice.beta.agents.list(), { status: HttpStatusCode.Unauthorized });
  await assert.rejects(deployment.beta.agents.list(), { status: HttpStatusCode.Unauthorized });
}
