import type { SourceId } from '@mechane/records';
import type { MutableRef } from 'effect';
import type { GuestSettings, SourceRequest } from '../types.ts';

/** The checkout progress shared by every request of one admitted generation. */
export type SourceProgress = { readonly isCloned: boolean; readonly isCloning: boolean; readonly isActivated: boolean };

/** A generation's immutable identity and the progress its requests update. */
export type SourceLease = {
  readonly sourceId: SourceId;
  readonly generation: SourceId;
  readonly progress: MutableRef.MutableRef<SourceProgress>;
};

/** A request whose source generation already holds the guest fence. */
export type SourceStepInput = SourceRequest & { readonly settings: GuestSettings; readonly lease: SourceLease };
