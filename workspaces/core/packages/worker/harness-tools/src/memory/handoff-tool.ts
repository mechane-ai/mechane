import { defineTool } from '@earendil-works/pi-durable';
import type { ToolRegistration } from '@earendil-works/pi-durable';
import { Type } from 'typebox';
import { MemoryDescription, MemoryTool } from './constants.ts';

const HandoffParameters = Type.Object({
  note: Type.String({ description: 'What your fresh context starts from: what you were doing and what comes next' }),
});

/**
 * Resets the mech's context to its note: pi appends a reset that starts from the note once the round ends. The turn
 * ends answered by the call's own message. The call has no effect of its own, so pi may run it again after a restart.
 */
export function handoffTool(): ToolRegistration<typeof HandoffParameters> {
  const execute: ToolRegistration<typeof HandoffParameters>['execute'] = async ({ note }) => ({
    output: [{ type: 'text', text: 'Your context starts again from your note once this round ends' }],
    control: { handoff: note },
  });

  return defineTool({
    name: MemoryTool.Handoff,
    description: MemoryDescription.Handoff,
    parameters: HandoffParameters,
    replay: 'safe',
    execute,
  });
}
