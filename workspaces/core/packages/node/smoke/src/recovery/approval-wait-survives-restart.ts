import { SlackDeliveries } from '@mechane/protocol';
import { HttpStatusCode, SlackDeliveryStatus } from '@mechane/records';
import {
  configureNexusRequests,
  connectSlack,
  createAccount,
  createMech,
  createNexusOutcome,
  deliverNexusOutcome,
  postSlackMessage,
  readTurns,
  requireFixtures,
  runCli,
  waitFor,
} from '@mechane/testing';
import type { ScenarioInput } from '@mechane/testing';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

const MILLISECONDS_PER_SECOND = 1000;
const ACCEPTED_RUN_COUNT = 2;

export async function approvalWaitSurvivesRestart({ stack }: ScenarioInput): Promise<void> {
  const fixtures = requireFixtures(stack);
  const account = await createAccount({ stack });
  const marker = `approval-${randomUUID()}`;
  const queuedMarker = `queued-${randomUUID()}`;
  const completedMarker = `completed-${randomUUID()}`;
  const queuedReply = `completed-${randomUUID()}`;
  const mech = await createMech({ stack, account, name: marker });

  await configureNexusRequests({ stack, account, mechId: mech.id });

  const slack = await connectSlack({ stack, account, mechId: mech.id });

  fixtures.model.configure({
    marker,
    replies: [
      {
        tools: [
          { id: randomUUID(), name: 'request_access', input: { capability: 'home-links', reason: marker, minutes: 5 } },
        ],
      },
      { text: `**${completedMarker}** [Cloudflare](https://dash.cloudflare.com/)` },
    ],
  });
  fixtures.model.configure({ marker: queuedMarker, replies: [{ text: queuedReply }] });

  const timestamp = Math.floor(Date.now() / MILLISECONDS_PER_SECOND);
  const originalTimestamp = `${timestamp}.000001`;
  const queuedTimestamp = `${timestamp}.000002`;
  const originalEventId = randomUUID();

  const accepted = await postSlackMessage({
    origin: stack.origin,
    workspaceId: account.workspaceId,
    slack,
    text: marker,
    messageTimestamp: originalTimestamp,
    eventId: originalEventId,
  });

  assert.equal(accepted.status, HttpStatusCode.Ok);

  const requests = await waitFor({
    name: 'the access request from this Slack task',
    read: async () => fixtures.nexus.readRequests(),
    accept: (observedRequests) => observedRequests.some((candidate) => candidate.body['reason'] === marker),
  });

  const request = requests.find((candidate) => candidate.body['reason'] === marker);

  if (request === undefined || request.approval === null) {
    throw new Error('The Nexus fixture did not create the requested approval');
  }

  assert.equal(request.status, 'pending');

  const task = request.body['task'];

  assert.ok(typeof task === 'object' && task !== null && 'slack' in task);
  assert.deepEqual(task.slack, {
    workspaceId: slack.teamId,
    userId: slack.userId,
    channelId: slack.channelId,
    threadTs: originalTimestamp,
    messageTs: originalTimestamp,
  });

  const queued = await postSlackMessage({
    origin: stack.origin,
    workspaceId: account.workspaceId,
    slack,
    text: queuedMarker,
    messageTimestamp: queuedTimestamp,
  });

  assert.equal(queued.status, HttpStatusCode.Ok);

  const repeatedInput = await postSlackMessage({
    origin: stack.origin,
    workspaceId: account.workspaceId,
    slack,
    text: marker,
    messageTimestamp: originalTimestamp,
    eventId: originalEventId,
  });

  assert.equal(repeatedInput.status, HttpStatusCode.Ok);

  const acceptedRuns = await readTurns({ stack, account, mechId: mech.id });

  assert.equal(acceptedRuns.length, ACCEPTED_RUN_COUNT);

  const approvalId = request.approval.id;

  await waitFor({
    name: 'the pending approval to reach its Slack requester',
    read: async () => fixtures.slack.readMessages(),
    accept: (messages) => messages.some((message) => JSON.stringify(message).includes(approvalId)),
  });
  await waitFor({
    name: 'the approval notification to be acknowledged before the runtime stops',
    read: readDeliveries,
    accept: ({ deliveries }) =>
      deliveries.length > 0 && deliveries.every((delivery) => delivery.status === SlackDeliveryStatus.Sent),
  });

  await stack.restart({ signal: 'SIGKILL' });

  const slackCallsBeforeResume = fixtures.slack.readCalls().length;

  fixtures.slack.loseNextPostReceipt();

  const event = createNexusOutcome({
    serviceId: fixtures.nexus.serviceId,
    requestId: request.id,
    kind: 'access',
    status: 'ready',
    approvalId,
  });

  const forged = await deliverNexusOutcome({ origin: stack.origin, signingSecret: randomUUID(), event });

  assert.equal(forged.status, HttpStatusCode.Unauthorized);
  fixtures.nexus.resolve({ id: request.id, status: 'ready' });

  const decisions = await Promise.all([
    deliverNexusOutcome({ origin: stack.origin, signingSecret: fixtures.nexus.signingSecret, event }),
    deliverNexusOutcome({ origin: stack.origin, signingSecret: fixtures.nexus.signingSecret, event }),
  ]);

  assert.ok(decisions.every((response) => response.ok));

  const completed = await waitFor({
    name: 'the approved Slack work and the input queued behind it',
    read: async () => fixtures.slack.readMessages(),
    accept: (messages) =>
      messages.some((message) => JSON.stringify(message).includes(completedMarker)) &&
      messages.some((message) => JSON.stringify(message).includes(queuedReply)),
  });

  const replies = completed.filter((message) => JSON.stringify(message).includes(completedMarker));
  const queuedReplies = completed.filter((message) => JSON.stringify(message).includes(queuedReply));

  assert.equal(replies.length, 1);
  assert.equal(replies[0]?.channel, slack.channelId);
  assert.equal(replies[0].thread_ts, originalTimestamp);
  assert.equal(queuedReplies.length, 1);
  assert.equal(queuedReplies[0]?.thread_ts, queuedTimestamp);

  await waitFor({
    name: 'the uncertain Slack result to be reconciled without posting another result',
    read: readDeliveries,
    accept: ({ deliveries }) =>
      deliveries.length > 0 && deliveries.every((delivery) => delivery.status === SlackDeliveryStatus.Sent),
  });

  const slackCalls = fixtures.slack.readCalls();

  assert.ok(slackCalls.slice(slackCallsBeforeResume).some((call) => call.method === 'conversations.replies'));

  const posted = slackCalls.filter((call) => call.method === 'chat.postMessage');

  const resultPosts = posted.filter(
    (call) => typeof call.body['markdown_text'] === 'string' && call.body['markdown_text'].includes(completedMarker),
  );

  assert.equal(resultPosts.length, 1);

  const payload = resultPosts[0]?.body;

  assert.ok(payload !== undefined && typeof payload['markdown_text'] === 'string');
  assert.ok(payload['markdown_text'].includes('https://dash.cloudflare.com/'));
  assert.equal(payload['text'], undefined);

  const calls = fixtures.model.readCalls().filter((call) => call.marker === marker || call.marker === queuedMarker);

  assert.deepEqual(
    calls.map((call) => call.marker),
    [marker, marker, queuedMarker],
  );

  const repeated = await deliverNexusOutcome({
    origin: stack.origin,
    signingSecret: fixtures.nexus.signingSecret,
    event,
  });

  assert.ok(repeated.ok);

  const settledRuns = await readTurns({ stack, account, mechId: mech.id });

  assert.equal(settledRuns.length, ACCEPTED_RUN_COUNT);

  async function readDeliveries(): Promise<SlackDeliveries> {
    return await runCli({
      stack,
      account,
      args: ['slack', 'deliveries', mech.id, '--workspace', account.workspaceId],
      schema: SlackDeliveries,
    });
  }
}
