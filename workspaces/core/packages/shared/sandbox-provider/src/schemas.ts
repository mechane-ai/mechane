import { Schema } from 'effect';

export const PluggableSandboxProvider = Schema.Literals(['cloudflare', 'docker', 'modal', 'tensorlake', 'none']);

export type PluggableSandboxProvider = typeof PluggableSandboxProvider.Type;

export const SandboxLifecycleState = Schema.Literals(['starting', 'running', 'suspended', 'stopped', 'failed']);

export type SandboxLifecycleState = typeof SandboxLifecycleState.Type;

export const SandboxHandle = Schema.Struct({
  provider: PluggableSandboxProvider,
  sandboxId: Schema.NonEmptyString,
  status: SandboxLifecycleState,
  sandboxUrl: Schema.optionalKey(Schema.NullOr(Schema.String)),
  reason: Schema.optionalKey(Schema.NullOr(Schema.String)),
});

export type SandboxHandle = typeof SandboxHandle.Type;

export const SandboxSnapshot = Schema.Struct({ snapshotId: Schema.NonEmptyString, createdAt: Schema.NonEmptyString });

export type SandboxSnapshot = typeof SandboxSnapshot.Type;

export const SandboxStopResult = Schema.Struct({ snapshotId: Schema.NullOr(Schema.String) });

export type SandboxStopResult = typeof SandboxStopResult.Type;

export const SandboxEvidenceKind = Schema.Literals(['screenshot', 'recording']);

export type SandboxEvidenceKind = typeof SandboxEvidenceKind.Type;

export const SandboxEvidenceMetadata = Schema.Struct({
  id: Schema.NonEmptyString,
  workspaceId: Schema.NonEmptyString,
  sessionId: Schema.NonEmptyString,
  turnId: Schema.NullOr(Schema.String),
  kind: SandboxEvidenceKind,
  mediaType: Schema.NonEmptyString,
  sizeBytes: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
  sha256: Schema.NonEmptyString,
  width: Schema.NullOr(Schema.Int),
  height: Schema.NullOr(Schema.Int),
  durationMs: Schema.NullOr(Schema.Int),
  createdAt: Schema.NonEmptyString,
});

export type SandboxEvidenceMetadata = typeof SandboxEvidenceMetadata.Type;
