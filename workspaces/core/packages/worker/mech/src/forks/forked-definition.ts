import type { MechRow } from '@mechane/mech-store';
import { MechStatus } from '@mechane/protocol';
import { PrincipalId } from '@mechane/records';
import { Option } from 'effect';
import type { Forking } from './types.ts';

type ForkedDefinitionInput = Pick<Forking, 'parent' | 'fork' | 'sequence'>;

/** Builds the fork's active definition with its own identity and provenance after the inherited revision history. */
export function forkedDefinition({ parent, fork, sequence }: ForkedDefinitionInput): MechRow {
  const { id, name, requesterId: creatorId, startedAt: createdAt } = fork;
  const revision = parent.revision + 1;

  return {
    ...parent,
    id,
    name,
    creatorId,
    createdAt,
    forkedFrom: Option.some({ mechId: parent.id, sequence }),
    revision,
    activeRevision: revision,
    status: MechStatus.Active,
    updatedAt: createdAt,
    updaterId: PrincipalId.make(creatorId),
  };
}
