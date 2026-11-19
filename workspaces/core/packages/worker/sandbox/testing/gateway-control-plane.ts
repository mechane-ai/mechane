import { SandboxWebAccess } from '@mechane/deployment';
import { catalog } from '@mechane/protocol';
import { HttpHeader, HttpMethod, HttpStatusCode, MediaType } from '@mechane/records';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { passEgress } from '../src/egress/pass-egress.ts';
import type { EgressVariables } from '../src/egress/schemas.ts';

const ORIGIN = 'https://agents.example.com';
const ALIAS = 'https://alias.example.com';
const RUNTIME_ORIGIN = 'https://runtime.example.com';
const WORK_CREDENTIAL = 'Bearer sk-ant-req-fixture';
const MESSAGE_ID = 'b104e4ce-0918-46f9-96d8-c0fc70b0bcfe';

const settings = {
  origin: new URL(ORIGIN),
  runtimeOrigin: new URL(RUNTIME_ORIGIN),
  installationHosts: ['agents.example.com', 'alias.example.com'],
  hosts: [],
  webAccess: SandboxWebAccess.Packages,
} as const satisfies EgressVariables;

const refused = [
  {
    name: 'the retired self-message endpoint',
    origin: ORIGIN,
    path: `/api/v1/self/messages/${MESSAGE_ID}`,
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
    name: 'the retired self-wake endpoint',
    origin: ORIGIN,
    path: '/api/v1/self/wakes',
    method: HttpMethod.Post,
    host: 'agents.example.com',
  },
  {
    name: 'an installation alias',
    origin: ALIAS,
    path: catalog.listWorkspaces.path,
    method: HttpMethod.Get,
    host: 'alias.example.com',
  },
  {
    name: 'the separate runtime origin',
    origin: RUNTIME_ORIGIN,
    path: catalog.listWorkspaces.path,
    method: HttpMethod.Get,
    host: 'runtime.example.com',
  },
  {
    name: 'an unsupported control-plane port',
    origin: 'https://agents.example.com:8443',
    path: catalog.listWorkspaces.path,
    method: HttpMethod.Get,
    host: 'agents.example.com:8443',
  },
  {
    name: 'a disagreeing Host authority',
    origin: ORIGIN,
    path: catalog.listWorkspaces.path,
    method: HttpMethod.Get,
    host: 'alias.example.com',
  },
  {
    name: 'a private network target',
    origin: 'https://127.0.0.1',
    path: catalog.listWorkspaces.path,
    method: HttpMethod.Get,
    host: '127.0.0.1',
  },
  {
    name: 'a trailing-dot control-plane alias',
    origin: 'https://agents.example.com.',
    path: catalog.listWorkspaces.path,
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
      headers: { [HttpHeader.Host]: fixture.host, [HttpHeader.Authorization]: WORK_CREDENTIAL },
    });

    const response = await passEgress({ request, settings: { ...settings, webAccess: SandboxWebAccess.Public } });

    assert.equal(response.status, HttpStatusCode.Forbidden);
    assert.equal(outgoing.length, 0);
  });
}

void test('Gateway preserves a scoped SDK result and confines its credential to the canonical worker routes', async (context) => {
  const forwarded: Array<Request> = [];

  context.mock.method(console, 'log', () => undefined);
  context.mock.method(globalThis, 'fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    forwarded.push(new Request(input, init));

    return Response.json({ accepted: true });
  });

  const path = '/v1/sessions/sesn_fixture/events';
  const content = JSON.stringify({ events: [{ type: 'user.tool_result', tool_use_id: 'evt_fixture', content: [] }] });
  const headers = { [HttpHeader.Authorization]: WORK_CREDENTIAL, [HttpHeader.ContentType]: MediaType.Json };
  const request = new Request(new URL(path, ORIGIN), { method: HttpMethod.Post, headers, body: content });
  const accepted = await passEgress({ request, settings });

  assert.equal(accepted.status, HttpStatusCode.Ok);
  assert.equal(forwarded.length, 1);

  const [result] = forwarded;

  assert.ok(result instanceof Request);
  assert.equal(result.url, request.url);
  assert.equal(result.headers.get(HttpHeader.Authorization), WORK_CREDENTIAL);
  assert.equal(result.redirect, 'manual');
  assert.equal(await result.text(), content);

  const disallowed = [
    new Request(new URL(path, 'https://code.example.org'), { headers }),
    new Request(new URL(path, ALIAS), { headers }),
    new Request(new URL(path, ORIGIN), { headers: { ...headers, [HttpHeader.Cookie]: 'member=fixture' } }),
    new Request(new URL('/v1/sessions/sesn_fixture/threads/thread_fixture/events', ORIGIN), { headers }),
    new Request(new URL('/v1/environments/env_fixture/work/poll', ORIGIN), { headers }),
  ];

  for (const candidate of disallowed) {
    const response = await passEgress({
      request: candidate,
      settings: { ...settings, webAccess: SandboxWebAccess.Public },
    });

    assert.equal(response.status, HttpStatusCode.Forbidden);
  }

  assert.equal(forwarded.length, 1);
});
