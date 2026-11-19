import { listArchivedCompletions } from './list-archived-completions.ts';
import { listMechRevisions } from './list-mech-revisions.ts';
import { listMechs } from './list-mechs.ts';
import { showMech } from './show-mech.ts';

/** Native definitions and saved revisions for operator inspection. */
export const MECH_OPERATIONS = { listMechs, listMechRevisions, listArchivedCompletions, showMech } as const;
