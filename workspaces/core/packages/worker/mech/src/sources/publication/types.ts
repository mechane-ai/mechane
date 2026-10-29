import type { SourcePublication, SourceTask } from '@mechane/mech-store';
import type { SourceAction, SourceRequest } from '@mechane/protocol';
import type { PrincipalId } from '@mechane/records';
import type { Redacted } from 'effect';
import type { SourceTaskInput } from '../types.ts';

type PublishAction = { readonly action: typeof SourceAction.Publish };
/** Only the explicit owner publication action can freeze a draft intent. */
export type PublishSourceRequest = Extract<SourceRequest, PublishAction>;

export type PublicationIntentInput = {
  readonly source: SourceTask;
  readonly request: PublishSourceRequest;
  readonly principalId: PrincipalId;
};

/** The durable task carries publication state across externally uncertain mutations. */
export type PublicationSource = SourceTask;
export type SourcePublicationInput = Omit<SourceTaskInput, 'source'> & { readonly source: PublicationSource };
export type PublishSourceIntentInput = SourcePublicationInput & { readonly token: Redacted.Redacted };
export type ExistingPublicationInput = SourcePublicationInput & { readonly publication: SourcePublication };
