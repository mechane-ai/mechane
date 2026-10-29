import type { DroppedName } from '../types.ts';

/** The key of a name a statement takes: the statement's start and the name it binds there. */
export function droppedNameKey({ start, local }: DroppedName): string {
  return `${start}:${local}`;
}
