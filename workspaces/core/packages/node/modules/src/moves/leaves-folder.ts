import { dirname } from 'node:path';
import type { Unit } from '../types.ts';

/** A unit, and the folder a move would take it to. */
type LeavesFolderInput = { readonly unit: Unit; readonly folder: string };

/** Whether a move to the folder takes a located unit out of its own, where its value depends on the folder. */
export function leavesFolder({ unit, folder }: LeavesFolderInput): boolean {
  return unit.isLocated && folder !== dirname(unit.path);
}
