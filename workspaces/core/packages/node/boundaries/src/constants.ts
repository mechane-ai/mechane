import { CACHE_FOLDER } from '@mechane/checks-kernel';

/** The module graph the boundaries check cruised, each file with the files it imports, which the changed set reads. */
export const MODULE_GRAPH = `${CACHE_FOLDER}module-graph.json`;

/** The member manifest, which declares every member with its layer, lane and consumers. */
export const MEMBER_MANIFEST = 'dependencies.json';

/** The dependency-cruiser configuration whose options and rules the boundaries check cruises with. */
export const CRUISER_CONFIGURATION = '.dependency-cruiser.cjs';
