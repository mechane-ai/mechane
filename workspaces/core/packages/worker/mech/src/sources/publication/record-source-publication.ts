import type { MechTables, SourcePublication, SourceTask } from '@mechane/mech-store';
import { Option } from 'effect';
import type { OpenedMech } from '../../types.ts';
import type { PublicationSource } from './types.ts';

type RecordSourcePublicationInput = {
  readonly mech: OpenedMech;
  readonly source: SourceTask;
  readonly publication: SourcePublication;
};

/** Persists each publication transition before its next external write. */
export async function recordSourcePublication({
  mech,
  source,
  publication,
}: RecordSourcePublicationInput): Promise<PublicationSource> {
  const next = { ...source, publication: Option.some(publication) };
  const run: (store: MechTables) => void = (store) => store.saveSourceTask({ source: next });

  await mech.store.atomic({ run });

  return next;
}
