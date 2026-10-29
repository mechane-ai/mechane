import { RoleFile } from '@mechane/modules';
import { Record } from 'effect';

/** Every role file's stem. */
export const ROLE_FILE_STEMS: ReadonlySet<string> = new Set(Record.values(RoleFile));

/** The stem of a concept's role file, such as `drones.types`, which splits a role file past the file limit (ST-20). */
export const CONCEPT_ROLE_STEM: Readonly<RegExp> = /\.(types|constants|schemas|errors)$/;
