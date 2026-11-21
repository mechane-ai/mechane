import Anthropic, { toFile } from '@anthropic-ai/sdk';
import { sessionsTokenFromSecret } from '@anthropic-ai/sdk/lib/environments/worker';
import { managedWorkspaceId } from '@mechane/managed-protocol';
import { HttpHeader, HttpMethod, HttpStatusCode, MediaType } from '@mechane/records';
import { createAccount, issueEnvironmentKey, requireFixtures, waitFor } from '@mechane/testing';
import type { ScenarioInput } from '@mechane/testing';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

const STREAM_TIMEOUT_MS = 30_000;
const EXPIRES_IN_SECONDS = 7200;
const EXPECTED_MOUNTED_RESOURCES = 2;

export async function managedFilesAndSdkDropIn({ stack }: ScenarioInput): Promise<void> {
  const { github, model } = requireFixtures(stack);
  const marker = randomUUID();
  const baseURL = stack.origin.origin;
  const ownerAccount = await createAccount({ stack, login: github.users.owner.login });
  const memberAccount = await createAccount({ stack, login: github.users.member.login });
  const owner = new Anthropic({ apiKey: ownerAccount.token, baseURL, maxRetries: 0 });
  const other = new Anthropic({ apiKey: memberAccount.token, baseURL, maxRetries: 0 });

  // 1. Upload, retrieve, list (cursor + ids[]), download, and isolate files via official SDK.
  const firstBody = `brief-${marker}\n`;
  const secondBody = `appendix-${marker}\n`;

  const firstFile = await owner.beta.files.upload({
    file: await toFile(Buffer.from(firstBody, 'utf8'), 'nested/dir/brief.txt', { type: MediaType.PlainText }),
    expires_in_seconds: EXPIRES_IN_SECONDS,
  });

  assert.match(firstFile.id, /^file_/u);
  assert.equal(firstFile.type, 'file');
  assert.equal(firstFile.filename, 'brief.txt');
  assert.equal(firstFile.mime_type, MediaType.PlainText);
  assert.equal(firstFile.size_bytes, Buffer.byteLength(firstBody, 'utf8'));
  assert.equal(firstFile.downloadable, true);
  assert.ok(typeof firstFile.expires_at === 'string' && Date.parse(firstFile.expires_at) > Date.now());

  const secondFile = await owner.beta.files.upload({
    file: await toFile(Buffer.from(secondBody, 'utf8'), 'appendix.txt', { type: MediaType.PlainText }),
  });

  assert.equal(secondFile.expires_at, null);

  const metadata = await owner.beta.files.retrieveMetadata(firstFile.id);

  assert.deepEqual(metadata, firstFile);
  await assert.rejects(other.beta.files.retrieveMetadata(firstFile.id), { status: HttpStatusCode.Forbidden });

  const downloaded = await owner.beta.files.download(firstFile.id);

  assert.equal(downloaded.status, HttpStatusCode.Ok);
  assert.equal(downloaded.headers.get(HttpHeader.XContentTypeOptions), 'nosniff');
  assert.match(downloaded.headers.get(HttpHeader.ContentDisposition) ?? '', /filename="brief\.txt"/u);
  assert.equal(await downloaded.text(), firstBody);

  // Verify cursor pagination and ids[] lookup semantics.
  const pageOne = await owner.beta.files.list({ limit: 1 });

  assert.equal(pageOne.data.length, 1);
  assert.ok(typeof pageOne.next_page === 'string' && pageOne.next_page.startsWith('page_'));

  const byIds = await owner.beta.files.list({ ids: [firstFile.id, 'file_missing_ignored'] });

  assert.equal(byIds.next_page, null);
  assert.deepEqual(
    byIds.data.map((entry) => entry.id),
    [firstFile.id],
  );

  await assert.rejects(owner.beta.files.list({ ids: [firstFile.id], limit: 1 }), { status: HttpStatusCode.BadRequest });

  // Verify explicit files-api beta header is accepted alongside no-beta SDK default.
  const explicitBeta = await fetch(new URL('/v1/files', stack.origin), {
    method: HttpMethod.Get,
    headers: {
      [HttpHeader.ApiKey]: ownerAccount.token,
      [HttpHeader.AnthropicVersion]: '2026-10-21',
      [HttpHeader.AnthropicBeta]: 'files-api-2025-04-14',
    },
  });

  assert.equal(explicitBeta.status, HttpStatusCode.Ok);

  // 1b. Verify API-key multi-workspace routing via anthropic-workspace-id (wrkspc_<32hex> and UUID).
  const personalWorkspaceHeader = managedWorkspaceId({ workspaceId: ownerAccount.workspaceId });

  const ownerPersonal = new Anthropic({
    apiKey: ownerAccount.token,
    baseURL,
    maxRetries: 0,
    defaultHeaders: { 'anthropic-workspace-id': personalWorkspaceHeader },
  });

  const personalBody = `personal-${marker}\n`;

  const personalFile = await ownerPersonal.beta.files.upload({
    file: await toFile(Buffer.from(personalBody, 'utf8'), 'personal.txt', { type: MediaType.PlainText }),
  });

  const personalMetadata = await ownerPersonal.beta.files.retrieveMetadata(personalFile.id);

  assert.equal(personalMetadata.id, personalFile.id);
  await assert.rejects(owner.beta.files.retrieveMetadata(personalFile.id), { status: HttpStatusCode.NotFound });

  const otherPersonal = new Anthropic({
    apiKey: memberAccount.token,
    baseURL,
    maxRetries: 0,
    defaultHeaders: { 'anthropic-workspace-id': personalWorkspaceHeader },
  });

  await assert.rejects(otherPersonal.beta.files.list(), { status: HttpStatusCode.Forbidden });

  const invalidWorkspaceClient = new Anthropic({
    apiKey: ownerAccount.token,
    baseURL,
    maxRetries: 0,
    defaultHeaders: { 'anthropic-workspace-id': 'wrkspc_not_a_real_workspace' },
  });

  await assert.rejects(invalidWorkspaceClient.beta.files.list(), { status: HttpStatusCode.Forbidden });

  const invalidKeyClient = new Anthropic({
    apiKey: 'mk_invalid_key',
    baseURL,
    maxRetries: 0,
    defaultHeaders: { 'anthropic-workspace-id': personalWorkspaceHeader },
  });

  await assert.rejects(invalidKeyClient.beta.files.list(), { status: HttpStatusCode.Unauthorized });
  await ownerPersonal.beta.files.delete(personalFile.id);

  // 2. Create an agent using an explicit bare model alias and stream a real turn via SSE.
  const environment = await owner.beta.environments.create({ name: marker, config: { type: 'self_hosted' } });

  const agent = await owner.beta.agents.create({
    name: marker,
    model: 'claude-haiku-4-5',
    tools: [{ type: 'agent_toolset_20260401' }],
  });

  assert.deepEqual(agent.model, { id: 'claude-haiku-4-5', speed: 'standard' });

  const session = await owner.beta.sessions.create({
    agent: agent.id,
    environment_id: environment.id,
    resources: [{ type: 'file', file_id: firstFile.id, mount_path: '/uploads/brief.txt' }],
  });

  const [mountedFirst] = session.resources;

  assert.ok(mountedFirst?.type === 'file');
  assert.equal(mountedFirst.file_id, firstFile.id);
  assert.equal(mountedFirst.mount_path, '/uploads/brief.txt');

  // 3. Validate dynamic session resource add, collision/traversal rejection, and delete.
  await assert.rejects(
    owner.beta.sessions.resources.add(session.id, {
      type: 'file',
      file_id: secondFile.id,
      mount_path: '/workspace/../escape.txt',
    }),
    { status: HttpStatusCode.BadRequest },
  );
  await assert.rejects(
    owner.beta.sessions.resources.add(session.id, {
      type: 'file',
      file_id: secondFile.id,
      mount_path: '/workspace/uploads/brief.txt',
    }),
    { status: HttpStatusCode.BadRequest },
  );

  const added = await owner.beta.sessions.resources.add(session.id, { type: 'file', file_id: secondFile.id });

  assert.equal(added.type, 'file');
  assert.equal(added.file_id, secondFile.id);
  assert.equal(added.mount_path, '/workspace/uploads/appendix.txt');

  const listedResources = await owner.beta.sessions.resources.list(session.id);

  assert.equal(listedResources.data.length, EXPECTED_MOUNTED_RESOURCES);

  const removed = await owner.beta.sessions.resources.delete(added.id, { session_id: session.id });

  assert.deepEqual(removed, { type: 'session_resource_deleted', id: added.id });

  // 4. Verify bare alias model turn streams cleanly over SSE.
  const prompt = `alias-turn-${marker}`;

  model.configure({ marker: prompt, replies: [{ text: `ack-${marker}` }] });

  const stop = new AbortController();

  const stream = await owner.beta.sessions.events.stream(
    session.id,
    {},
    { signal: AbortSignal.any([stop.signal, AbortSignal.timeout(STREAM_TIMEOUT_MS)]) },
  );

  try {
    await owner.beta.sessions.events.send(session.id, {
      events: [{ type: 'user.message', content: [{ type: 'text', text: prompt }] }],
    });

    let hasReplied = false;

    for await (const frame of stream) {
      if (frame.type === 'session.error') {
        throw new Error(`Aliased model turn failed: ${JSON.stringify(frame.error)}`);
      }

      if (
        frame.type === 'agent.message' &&
        frame.content.some((block) => block.type === 'text' && block.text === `ack-${marker}`)
      ) {
        hasReplied = true;
      }

      if (hasReplied && frame.type === 'session.status_idle') {
        break;
      }
    }

    assert.equal(hasReplied, true);
  } finally {
    stop.abort();
  }

  // 5. Verify scoped work credential can read ONLY mounted session files and cannot mutate files.
  const toolPrompt = `worker-file-${marker}`;

  model.configure({
    marker: toolPrompt,
    replies: [{ tools: [{ id: randomUUID(), name: 'read', input: { file_path: 'uploads/brief.txt' } }] }],
  });

  const poller = new Anthropic({
    authToken: await issueEnvironmentKey({
      origin: stack.origin,
      environmentId: environment.id,
      token: ownerAccount.token,
    }),
    baseURL,
    maxRetries: 0,
  });

  await owner.beta.sessions.events.send(session.id, {
    events: [{ type: 'user.message', content: [{ type: 'text', text: toolPrompt }] }],
  });

  const work = await waitFor({
    name: 'session work claimed for mounted file authorization',
    read: () => poller.beta.environments.work.poll(environment.id, { block_ms: 500 }),
    accept: (receipt) => receipt !== null && receipt.data.id === session.id,
  });

  assert.ok(work !== null && work.secret !== null);
  await poller.beta.environments.work.ack(work.id, { environment_id: environment.id });

  const authToken = sessionsTokenFromSecret(work.secret);

  assert.ok(typeof authToken === 'string' && authToken.length > 0);

  const runner = new Anthropic({ authToken, baseURL, maxRetries: 0 });
  const workerMetadata = await runner.beta.files.retrieveMetadata(firstFile.id);

  assert.equal(workerMetadata.id, firstFile.id);

  const workerDownload = await runner.beta.files.download(firstFile.id);

  assert.equal(await workerDownload.text(), firstBody);

  await assert.rejects(runner.beta.files.download(secondFile.id), { status: HttpStatusCode.NotFound });
  await assert.rejects(runner.beta.files.list(), { status: HttpStatusCode.Forbidden });
  await assert.rejects(runner.beta.files.delete(firstFile.id), { status: HttpStatusCode.Forbidden });

  // Scoped worker may upload outputs strictly into its own active session scope.
  const outputBody = `generated-${marker}\n`;

  const exportedOutput = await runner.beta.files.upload({
    file: await toFile(Buffer.from(outputBody, 'utf8'), 'report.txt', { type: MediaType.PlainText }),
  });

  assert.equal(exportedOutput.filename, 'report.txt');
  assert.deepEqual(exportedOutput.scope, { id: session.id, type: 'session' });

  const scopedOutputs = await owner.beta.files.list({ scope_id: session.id });

  assert.deepEqual(
    scopedOutputs.data.map((entry) => entry.id),
    [exportedOutput.id],
  );

  const exportedDownload = await owner.beta.files.download(exportedOutput.id);

  assert.equal(await exportedDownload.text(), outputBody);
  await assert.rejects(runner.beta.files.delete(exportedOutput.id), { status: HttpStatusCode.Forbidden });

  await owner.beta.environments.work.stop(work.id, { environment_id: environment.id, force: true });
  await assert.rejects(
    runner.beta.files.upload({
      file: await toFile(Buffer.from('after-stop', 'utf8'), 'late.txt', { type: MediaType.PlainText }),
    }),
    { status: HttpStatusCode.Unauthorized },
  );

  // 6. Delete files and confirm they disappear cleanly.
  await owner.beta.files.delete(exportedOutput.id);

  const deletedFirst = await owner.beta.files.delete(firstFile.id);

  assert.deepEqual(deletedFirst, { id: firstFile.id, type: 'file_deleted' });
  await assert.rejects(owner.beta.files.retrieveMetadata(firstFile.id), { status: HttpStatusCode.NotFound });
  await assert.rejects(owner.beta.files.download(firstFile.id), { status: HttpStatusCode.NotFound });

  await owner.beta.files.delete(secondFile.id);
  await owner.beta.agents.archive(agent.id);
  await owner.beta.environments.archive(environment.id);
}
