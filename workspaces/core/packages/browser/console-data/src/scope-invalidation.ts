import { EvidenceArtifactId, MechId, PrincipalId, TurnId, WorkspaceId } from '@mechane/records';
import { Schema } from 'effect';
import { ReadId } from './requests.ts';

export const INVALIDATION_CHANNEL = 'mechane-console-admission';
const BROWSER_SCOPE = 'browser';

export const INVALIDATION_KIND = {
  Session: 'session',
  Mech: 'mech',
  Turn: 'turn',
  Artifact: 'artifact',
  Read: 'read',
} as const;

const SessionInvalidation = Schema.Struct({ kind: Schema.Literal(INVALIDATION_KIND.Session) });

const InvalidationTarget = Schema.Union([
  SessionInvalidation,
  Schema.Struct({ kind: Schema.Literal(INVALIDATION_KIND.Mech), workspaceId: WorkspaceId, mechId: MechId }),
  Schema.Struct({
    kind: Schema.Literal(INVALIDATION_KIND.Turn),
    workspaceId: WorkspaceId,
    mechId: MechId,
    turnId: TurnId,
  }),
  Schema.Struct({
    kind: Schema.Literal(INVALIDATION_KIND.Artifact),
    workspaceId: WorkspaceId,
    mechId: MechId,
    artifactId: EvidenceArtifactId,
  }),
  Schema.Struct({ kind: Schema.Literal(INVALIDATION_KIND.Read), workspaceId: WorkspaceId, readId: ReadId }),
]);

export type InvalidationTarget = typeof InvalidationTarget.Type;

export const ScopeInvalidation = Schema.Union([
  Schema.Struct({ origin: Schema.String, principalId: PrincipalId, target: InvalidationTarget }),
  Schema.Struct({ origin: Schema.String, scope: Schema.Literal(BROWSER_SCOPE), target: SessionInvalidation }),
]);

type PublishScopeInvalidationInput = {
  readonly channel: BroadcastChannel;
  readonly invalidation: typeof ScopeInvalidation.Type;
};

export function publishScopeInvalidation({ channel, invalidation }: PublishScopeInvalidationInput): void {
  const message = Schema.encodeSync(ScopeInvalidation)(invalidation);

  // oxlint-disable-next-line unicorn/require-post-message-target-origin -- BroadcastChannel takes one argument.
  channel.postMessage(message);
}

type InvalidateBrowserSessionInput = { readonly origin: string };

export function invalidateBrowserSession({ origin }: InvalidateBrowserSessionInput): void {
  const channel = new BroadcastChannel(INVALIDATION_CHANNEL);

  try {
    publishScopeInvalidation({
      channel,
      invalidation: { origin, scope: BROWSER_SCOPE, target: { kind: INVALIDATION_KIND.Session } },
    });
  } finally {
    channel.close();
  }
}
