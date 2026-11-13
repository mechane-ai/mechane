import type { WorkspaceRestoration } from '@mechane/sandbox-store';
import { Option } from 'effect';
import type { WorkspaceProviderStepInput } from '../../types.ts';

type CurrentRestorationInput = Pick<WorkspaceProviderStepInput, 'store'> & {
  readonly restoration: WorkspaceRestoration;
};

/** A delayed transfer can advance only its original machine, generation, and saved cursor. */
export function isCurrentRestoration({ store, restoration }: CurrentRestorationInput): boolean {
  const current = store.workspace().restoration;

  return Option.exists(current, (value) => {
    const sameMachine = value.machineId === restoration.machineId && value.generation === restoration.generation;
    const sameProgress = value.source === restoration.source && value.part === restoration.part;

    return sameMachine && sameProgress;
  });
}
