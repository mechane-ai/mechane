import type { MutableRef, Option } from 'effect';
import type { ExecutionLedger, GuestSettings, SourceRequest } from '../../types.ts';
import type { SourceLease } from '../types.ts';

/** The single lease retained by the guest journal across requests. */
export type SourceState = MutableRef.MutableRef<Option.Option<SourceLease>>;

/** A request and the journal resources that may admit or release it. */
export type SourceAdmissionInput = SourceRequest & {
  readonly settings: GuestSettings;
  readonly ledger: ExecutionLedger;
  readonly state: SourceState;
};
