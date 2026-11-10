import { EventType, Mech, SlackBindingResult, SlackDeliveries } from '@mechane/protocol';
import { HttpStatusCode, MechId, MediaType, SlackBindingId, SlackDeliveryStatus } from '@mechane/records';
import type { SlackConnectionId } from '@mechane/records';
import { Duration, Effect, Option } from 'effect';
import { check } from '../check.ts';
import { runCli } from '../cli/run-cli.ts';
import { loggedEvents } from '../mechs/events/logged-events.ts';
import type { Account, ScenarioFailure, StackInput, WorkspaceAuthorityInput } from '../types.ts';
import { signedSlackCallback } from './signed-slack-callback.ts';

type VerifySlackCaptionAdmissionInput = WorkspaceAuthorityInput & {
  readonly connectionId: SlackConnectionId;
  readonly guarantee: string;
};

type ReadSettledSlackNoticesInput = StackInput & { readonly account: Account; readonly mechId: MechId };

const NOTICE_POLL_INTERVAL = Duration.millis(100);
const NOTICE_WAIT_TIMEOUT = Duration.seconds(20);
const EXPECTED_NOTICE_COUNT = 4;
const EXPECTED_INBOX_COUNT = 2;

/** Signed human input gets one durable outcome without paid work while the mech is paused. */
export const verifySlackCaptionAdmission = Effect.fn('verifySlackCaptionAdmission')(function* ({
  stack,
  workspace,
  connectionId,
  guarantee,
}: VerifySlackCaptionAdmissionInput): Effect.fn.Return<void, ScenarioFailure> {
  const environment = { ...workspace.owner.environment, MECHANE_WORKSPACE_ID: workspace.workspaceId };
  const account = { ...workspace.owner, environment };
  const command = { stack, environment, result: Mech };
  const created = yield* runCli({ ...command, args: ['mech', 'create', '--name', 'slack-caption-admission'] });
  const mechId = MechId.make(created.result.id);
  const revision = String(created.result.revision);

  yield* runCli({ ...command, args: ['mech', 'pause', mechId, '--expected-revision', revision] });

  const channelId = 'C_CAPTION';
  const bindingId = SlackBindingId.make(crypto.randomUUID());

  const binding = yield* runCli({
    stack,
    environment,
    result: SlackBindingResult,
    args: [
      'slack',
      'bind',
      mechId,
      '--binding-id',
      bindingId,
      '--connection-id',
      connectionId,
      '--team-id',
      'T_SMOKE',
      '--channel-id',
      channelId,
      '--listening',
      'true',
      '--replies',
      'false',
      '--allowed-user-ids',
      '["U_HUMAN"]',
    ],
  });

  const caption = 'Add the link described in this upload caption';
  const message = { type: 'message', channel: channelId, user: 'U_HUMAN', text: caption, ts: '1.000001' };

  const upload = {
    ...message,
    subtype: 'file_share',
    bot_id: null,
    files: [{ id: 'F_SCREENSHOT', mimetype: null, url_private_download: '' }],
  };

  const envelope = { type: 'event_callback', team_id: 'T_SMOKE', event_id: 'Ev_CAPTION', event: upload };
  const signed = { stack, workspaceId: workspace.workspaceId, connectionId, signingSecret: stack.modelUpstream.apiKey };
  const body = JSON.stringify(envelope);
  const admitted = yield* signedSlackCallback({ ...signed, body });
  const duplicate = yield* signedSlackCallback({ ...signed, body });

  const refused = { ...message, user: 'U_OTHER', ts: '1.000005' };
  const unsupported = { ...upload, text: '', ts: '1.000006' };

  const image = {
    ...upload,
    text: '',
    ts: '1.000007',
    files: [
      {
        id: 'F_IMAGE',
        mimetype: MediaType.Png,
        url_private: 'https://files.slack.com/files-pri/T_SMOKE-F_IMAGE/image.png',
      },
    ],
  };

  for (const event of [refused, unsupported, image]) {
    const callback = JSON.stringify({ ...envelope, event_id: `Ev_${event.ts}`, event });

    yield* signedSlackCallback({ ...signed, body: callback });
    yield* signedSlackCallback({ ...signed, body: callback });
  }

  const ignored = [
    { ...upload, ts: '1.000002', bot_id: 'B_OTHER' },
    { ...upload, ts: '1.000003', user: 'U_SMOKE' },
    { ...message, ts: '1.000004', subtype: 'message_changed' },
  ];

  for (const event of ignored) {
    const ignoredBody = JSON.stringify({ ...envelope, event_id: `Ev_${event.ts}`, event });

    yield* signedSlackCallback({ ...signed, body: ignoredBody });
  }

  const events = yield* loggedEvents({ stack, account, mechId, after: 0 });
  const inbox = events.filter((event) => event.type === EventType.InboxItemReceived);

  const notices = yield* readSettledSlackNotices({ stack, account, mechId }).pipe(
    Effect.timeoutOption(NOTICE_WAIT_TIMEOUT),
  );

  const hasNotices = Option.exists(notices, ({ deliveries }) => {
    const timestamps = deliveries.flatMap((delivery) => {
      const timestamp = Option.flatMap(delivery.destination, (destination) => destination.threadTimestamp);

      return Option.toArray(timestamp);
    });

    const threads = new Set(timestamps);

    return (
      deliveries.length === EXPECTED_NOTICE_COUNT &&
      threads.size === EXPECTED_NOTICE_COUNT &&
      deliveries.every((delivery) => delivery.status === SlackDeliveryStatus.Blocked)
    );
  });

  const conditions = [
    SlackBindingResult.guards.Configured(binding.result),
    admitted.status === HttpStatusCode.Ok,
    duplicate.status === HttpStatusCode.Ok,
    inbox.length === EXPECTED_INBOX_COUNT,
    inbox.some((event) => event.text === caption),
    !events.some((event) => event.type === EventType.TurnStarted),
    hasNotices,
  ];

  const detail = `Slack caption callbacks ${admitted.status}, ${duplicate.status}; inbox items ${inbox.length}; notices settled ${hasNotices}`;

  yield* check({ name: guarantee, conditions, detail });
});

const readSettledSlackNotices = Effect.fn('readSettledSlackNotices')(function* ({
  stack,
  account,
  mechId,
}: ReadSettledSlackNoticesInput): Effect.fn.Return<SlackDeliveries, ScenarioFailure> {
  const command = {
    stack,
    environment: account.environment,
    result: SlackDeliveries,
    args: ['slack', 'deliveries', mechId],
  };

  let listed = yield* runCli(command);

  while (listed.result.deliveries.some((delivery) => delivery.status === SlackDeliveryStatus.Pending)) {
    yield* Effect.sleep(NOTICE_POLL_INTERVAL);

    listed = yield* runCli(command);
  }

  return listed.result;
});
