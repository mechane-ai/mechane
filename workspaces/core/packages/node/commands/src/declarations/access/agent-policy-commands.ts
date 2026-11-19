import { ManagedAgentId, Micros, renamedWireStruct } from '@mechane/records';
import { Schema } from 'effect';
import { CommandShape, FlagKind } from '../../constants.ts';
import type { CommandDeclaration } from '../../types.ts';

const agentArgument = { name: 'agent-id', summary: 'the Managed Agent ID from ant beta:agents list' } as const;
const agentFields = { agentId: ManagedAgentId } as const;
const agentRenames = { agentId: 'agent-id' } as const;
const CapFromArgument = Schema.NumberFromString.pipe(Schema.decodeTo(Micros));

/** A workspace owner can inspect and set the agent's daily model budget. */
export const AGENT_POLICY_COMMANDS = {
  'agent-policy show': {
    summary: 'show the agent creator and daily spending cap in the selected workspace',
    shape: CommandShape.Document,
    operations: ['listWorkspaces', 'showManagedAgentPolicy'],
    arguments: [agentArgument],
    flags: {},
    input: renamedWireStruct({ fields: agentFields, renames: agentRenames }),
  },
  'agent-policy set': {
    summary: 'set the daily model spending cap for this agent across its sessions',
    shape: CommandShape.Document,
    operations: ['listWorkspaces', 'configureManagedAgentPolicy'],
    arguments: [agentArgument],
    flags: { 'daily-cap-micros': { kind: FlagKind.Text, summary: 'the daily model budget in micro-dollars' } },
    input: renamedWireStruct({
      fields: { ...agentFields, dailyCapMicros: CapFromArgument },
      renames: { ...agentRenames, dailyCapMicros: 'daily-cap-micros' },
    }),
  },
} as const satisfies Readonly<Record<string, CommandDeclaration>>;
