import { MutableRef, Option } from 'effect';
import type { ExecutionLedger, GuestSettings, SourceJournal } from '../../types.ts';
import type { SourceLease } from '../types.ts';
import { answerSource } from './answer-source.ts';

/** The execution admission gate and settings shared by every source request in this guest. */
type SourceJournalInput = { readonly settings: GuestSettings; readonly ledger: ExecutionLedger };

/** Retains one source generation's fence and progress until its explicit release. */
export function sourceJournal({ settings, ledger }: SourceJournalInput): SourceJournal {
  const empty = Option.none<SourceLease>();
  const state = MutableRef.make(empty);
  const answer: SourceJournal['answer'] = (request) => answerSource({ ...request, settings, ledger, state });

  return { answer };
}
