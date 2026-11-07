import { Schema } from 'effect';

/** Distinguishes known rejection from an action whose external effect remains unconfirmed. */
export const BrowserFailureTag = { Failed: 'BrowserFailed', Uncertain: 'BrowserUncertain' } as const;

/** Refines recovery and diagnostics without requiring callers to parse dependency text. */
export const BrowserFailureKind = {
  Target: 'target',
  Capacity: 'capacity',
  Transport: 'transport',
  Protocol: 'protocol',
  Storage: 'storage',
  Process: 'process',
  Capture: 'capture',
  Conflict: 'conflict',
} as const;

/** Reports a known rejection or local capture failure with no unacknowledged browser command. */
export class BrowserFailed extends Schema.TaggedError<BrowserFailed>()(BrowserFailureTag.Failed, {
  kind: Schema.Enum(BrowserFailureKind),
  reason: Schema.String,
}) {}

/** Reports an action whose external effect cannot be inferred safely from a missing or invalid reply. */
export class BrowserUncertain extends Schema.TaggedError<BrowserUncertain>()(BrowserFailureTag.Uncertain, {
  kind: Schema.Enum(BrowserFailureKind),
  reason: Schema.String,
}) {}

/** Preserves the distinction between known failure and uncertain browser effects until receipt creation. */
export type BrowserError = BrowserFailed | BrowserUncertain;
