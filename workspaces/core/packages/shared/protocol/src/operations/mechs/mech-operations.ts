import { cloneMech } from './clone-mech.ts';
import { createMech } from './create-mech.ts';
import { forkMech } from './fork-mech.ts';
import { listMechRevisions } from './list-mech-revisions.ts';
import { listMechs } from './list-mechs.ts';
import { showMech } from './show-mech.ts';
import { updateMech } from './update-mech.ts';

/** Mech creation, definition revisions, cloning and forks. */
export const MECH_OPERATIONS = {
  createMech,
  cloneMech,
  listMechs,
  listMechRevisions,
  showMech,
  updateMech,
  forkMech,
} as const;
