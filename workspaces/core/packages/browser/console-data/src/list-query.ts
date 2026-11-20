import { EvidenceStatus, MechSummary, TurnRuntimeSource, TurnStatus } from '@mechane/protocol';
import { Schema } from 'effect';
import { ManagedSession } from './managed-records.ts';

export const listFilters = {
  agents: ['active', 'archived'],
  sessions: Object.values(ManagedSession.fields.status.enums),
  sessionEvidence: Object.values(EvidenceStatus),
  mechs: Object.values(MechSummary.to.fields.status.enums),
  turns: [...Object.values(TurnStatus), TurnRuntimeSource.Imported],
} as const;

export type ListKind = keyof typeof listFilters;
type ListFilter<Kind extends ListKind> = (typeof listFilters)[Kind][number];

export type ListQuery = { readonly search?: string; readonly filter?: string };

export function listQuery<Kind extends ListKind>(kind: Kind, input: ListQuery = {}) {
  const search = input.search?.trim() ?? '';
  const options: ReadonlyArray<ListFilter<Kind>> = listFilters[kind];
  const filter = options.find((value) => value === input.filter);

  const isDefaultFilter = kind === 'agents' && filter === 'active';

  return { ...(search !== '' && { search }), ...(filter !== undefined && !isDefaultFilter && { filter }) };
}

export function listQueryFields<Kind extends ListKind>(kind: Kind) {
  return { search: Schema.optionalKey(Schema.String), filter: Schema.optionalKey(Schema.Literals(listFilters[kind])) };
}
