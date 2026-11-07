import { EventType, Mech, SlackBindingResult } from '@mechane/protocol';
import { HttpStatusCode, SlackBindingId } from '@mechane/records';
import type { SlackConnectionId } from '@mechane/records';
import { Effect } from 'effect';
import { check } from '../check.ts';
import { runCli } from '../cli/run-cli.ts';
import { loggedEvents } from '../mechs/events/logged-events.ts';
import type { ScenarioFailure, WorkspaceAuthorityInput } from '../types.ts';
import { signedSlackCallback } from './signed-slack-callback.ts';

type VerifySlackCaptionAdmissionInput = WorkspaceAuthorityInput & {
  readonly connectionId: SlackConnectionId;
  readonly guarantee: string;
};

/** Human upload captions must be durable once; bot and edit callbacks must not create work. */
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
  const mechId = created.result.id;
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
    ],
  });

  const caption = 'Add the link described in this upload caption';
  const message = { type: 'message', channel: channelId, user: 'U_HUMAN', text: caption, ts: '1.000001' };
  const upload = { ...message, subtype: 'file_share', bot_id: null, files: [{ id: 'F_SCREENSHOT' }] };
  const envelope = { type: 'event_callback', team_id: 'T_SMOKE', event_id: 'Ev_CAPTION', event: upload };
  const signed = { stack, workspaceId: workspace.workspaceId, connectionId, signingSecret: stack.modelUpstream.apiKey };
  const body = JSON.stringify(envelope);
  const admitted = yield* signedSlackCallback({ ...signed, body });
  const duplicate = yield* signedSlackCallback({ ...signed, body });

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

  const conditions = [
    SlackBindingResult.guards.Configured(binding.result),
    admitted.status === HttpStatusCode.Ok,
    duplicate.status === HttpStatusCode.Ok,
    inbox.length === 1,
    inbox.some((event) => event.text === caption),
    !events.some((event) => event.type === EventType.TurnStarted),
  ];

  const detail = `Slack caption callbacks ${admitted.status}, ${duplicate.status}; inbox items ${inbox.length}`;

  yield* check({ name: guarantee, conditions, detail });
});
