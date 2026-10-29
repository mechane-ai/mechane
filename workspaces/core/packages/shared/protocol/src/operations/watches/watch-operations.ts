import { listWatches } from './list-watches.ts';
import { setWatch } from './set-watch.ts';
import { updateWatchStatus } from './update-watch-status.ts';

/** Durable watch schedules and their state changes. */
export const WATCH_OPERATIONS = { setWatch, listWatches, updateWatchStatus } as const;
