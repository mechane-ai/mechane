import type { SlackConnectionId, WorkspaceId } from '@mechane/records';
import { Effect } from 'effect';
import type { Page } from '../browser/types.ts';
import type { ScenarioFailure, StackInput } from '../types.ts';
import { signedSlackCallback } from './signed-slack-callback.ts';

type SlackChallengeInput = StackInput & {
  readonly workspaceId: WorkspaceId;
  readonly connectionId: SlackConnectionId;
  readonly signingSecret: string;
};

/** The live callback exercises vault decryption without making an outbound Slack request. */
export const slackChallenge = Effect.fn('slackChallenge')(function* ({
  stack,
  workspaceId,
  connectionId,
  signingSecret,
}: SlackChallengeInput): Effect.fn.Return<Page, ScenarioFailure> {
  const body = JSON.stringify({ type: 'url_verification', challenge: 'runtime-slack-challenge' });

  return yield* signedSlackCallback({ stack, workspaceId, connectionId, signingSecret, body });
});
