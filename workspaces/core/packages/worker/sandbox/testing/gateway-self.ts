import { SandboxWebAccess } from '@mechane/deployment';
import { catalog } from '@mechane/protocol';
import { HttpHeader, HttpMethod, HttpStatusCode } from '@mechane/records';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { passEgress } from '../src/egress/pass-egress.ts';
import type { EgressVariables } from '../src/egress/schemas.ts';

const ORIGIN = 'https://agents.example.com';
const ALIAS = 'https://alias.example.com';
const RUNTIME_ORIGIN = 'https://runtime.example.com';
const SELF_CREDENTIAL = 'Bearer fixture-scoped-self-token';
const MESSAGE_ID = 'b104e4ce-0918-46f9-96d8-c0fc70b0bcfe';

const settings = {
  origin: new URL(ORIGIN),
  runtimeOrigin: new URL(RUNTIME_ORIGIN),
  installationHosts: ['agents.example.com', 'alias.example.com'],
  hosts: [],
  webAccess: SandboxWebAccess.Packages,
} as const satisfies EgressVariables;

function selfMessagePath({ messageId }: { readonly messageId: string }): string {
  const encoded = encodeURIComponent(messageId);

  return catalog.publishSelfMessage.path.replace(':message_id', encoded);
}

void test(
  'Gateway forwards the canonical self message through normal API authentication',
  { timeout: 5000 },
  async (context) => {
    const forwarded: Array<Request> = [];
    const upstream = Response.json({ receiver: 'self API' });

    const transport: typeof fetch = async (input, init) => {
      forwarded.push(new Request(input, init));

      return upstream;
    };

    context.mock.method(globalThis, 'fetch', transport);

    const path = selfMessagePath({ messageId: MESSAGE_ID });
    const url = new URL(path, ORIGIN);
    const body = JSON.stringify({ text: 'An explicit fixture message' });

    const request = new Request(url, {
      method: HttpMethod.Post,
      headers: {
        [HttpHeader.Authorization]: SELF_CREDENTIAL,
        [HttpHeader.Host]: 'agents.example.com',
        [HttpHeader.ProxyAuthorization]: 'fixture-proxy-credential',
      },
      body,
    });

    const response = await passEgress({ request, settings });

    assert.equal(response, upstream);
    assert.equal(forwarded.length, 1);

    const sent = forwarded[0];

    assert.ok(sent !== undefined);
    assert.equal(sent.url, url.href);
    assert.equal(sent.method, HttpMethod.Post);
    assert.equal(sent.headers.get(HttpHeader.Authorization), SELF_CREDENTIAL);
    assert.equal(sent.headers.get(HttpHeader.Host), null);
    assert.equal(sent.headers.get(HttpHeader.ProxyAuthorization), null);
    assert.equal(sent.redirect, 'manual');
    assert.equal(await sent.text(), body);
  },
);

void test(
  'Gateway preserves a self API authentication refusal without supplying credentials',
  { timeout: 5000 },
  async (context) => {
    const requests: Array<Request> = [];
    const denied = Response.json({ code: 'KeyMissing' }, { status: HttpStatusCode.Unauthorized });

    const transport: typeof fetch = async (input, init) => {
      requests.push(new Request(input, init));

      return denied;
    };

    context.mock.method(globalThis, 'fetch', transport);

    const url = new URL(catalog.listSelfWakes.path, ORIGIN);
    const request = new Request(url);
    const response = await passEgress({ request, settings });

    assert.equal(response, denied);
    assert.equal(response.status, HttpStatusCode.Unauthorized);
    assert.equal(requests.length, 1);
    assert.equal(requests[0]?.headers.get(HttpHeader.Authorization), null);
  },
);

const refused = [
  {
    name: 'an undeclared self method',
    origin: ORIGIN,
    path: catalog.listSelfWakes.path,
    method: HttpMethod.Post,
    host: 'agents.example.com',
  },
  {
    name: 'a member or principal API',
    origin: ORIGIN,
    path: catalog.listWorkspaces.path,
    method: HttpMethod.Get,
    host: 'agents.example.com',
  },
  {
    name: 'an invalid self resource identifier',
    origin: ORIGIN,
    path: selfMessagePath({ messageId: 'not-a-uuid' }),
    method: HttpMethod.Post,
    host: 'agents.example.com',
  },
  {
    name: 'an installation alias',
    origin: ALIAS,
    path: catalog.listSelfWakes.path,
    method: HttpMethod.Get,
    host: 'alias.example.com',
  },
  {
    name: 'the separate runtime origin',
    origin: RUNTIME_ORIGIN,
    path: catalog.listSelfWakes.path,
    method: HttpMethod.Get,
    host: 'runtime.example.com',
  },
  {
    name: 'an unsupported control-plane port',
    origin: 'https://agents.example.com:8443',
    path: catalog.listSelfWakes.path,
    method: HttpMethod.Get,
    host: 'agents.example.com:8443',
  },
  {
    name: 'a disagreeing Host authority',
    origin: ORIGIN,
    path: catalog.listSelfWakes.path,
    method: HttpMethod.Get,
    host: 'alias.example.com',
  },
  {
    name: 'a private network target',
    origin: 'https://127.0.0.1',
    path: catalog.listSelfWakes.path,
    method: HttpMethod.Get,
    host: '127.0.0.1',
  },
  {
    name: 'a trailing-dot control-plane alias',
    origin: 'https://agents.example.com.',
    path: catalog.listSelfWakes.path,
    method: HttpMethod.Get,
    host: 'agents.example.com.',
  },
] as const;

for (const fixture of refused) {
  void test(`Gateway refuses ${fixture.name} even with public web access`, { timeout: 5000 }, async (context) => {
    const outgoing: Array<Request> = [];

    const transport: typeof fetch = async (input, init) => {
      outgoing.push(new Request(input, init));

      return new Response(null);
    };

    context.mock.method(globalThis, 'fetch', transport);
    context.mock.method(console, 'log', () => undefined);

    const url = new URL(fixture.path, fixture.origin);

    const request = new Request(url, {
      method: fixture.method,
      headers: { [HttpHeader.Host]: fixture.host, [HttpHeader.Authorization]: SELF_CREDENTIAL },
    });

    const response = await passEgress({ request, settings: { ...settings, webAccess: SandboxWebAccess.Public } });

    assert.equal(response.status, HttpStatusCode.Forbidden);
    assert.equal(outgoing.length, 0);
  });
}
