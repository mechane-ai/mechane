import type { WorkspaceId } from '@mechane/records';
import type { Effect, Redacted } from 'effect';
import type { Page } from '../browser/types.ts';
import type { BrowserRefused } from '../errors.ts';
import type { TalkingMech } from '../mechs/types.ts';

/** A retained browser session, usable key, and pending sign-in captured before admission changes. */
export type PrivateAdmissionFixture = {
  readonly mech: TalkingMech;
  readonly workspaceId: WorkspaceId;
  readonly credential: Redacted.Redacted;
  readonly pendingLogin: string;
  readonly approvalUrl: URL;
  readonly approvalAttempt: Effect.Effect<Page, BrowserRefused>;
};
