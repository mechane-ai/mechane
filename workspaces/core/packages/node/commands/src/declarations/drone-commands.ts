import { DroneId, RecordId, renamedWireStruct } from '@mechane/records';
import { CommandShape } from '../constants.ts';
import type { CommandDeclaration } from '../types.ts';
import { MECH_ARGUMENT } from './constants.ts';
import { MechCommandInput } from './schemas.ts';

/** The argument that names a drone of the mech, by the id `mechane drone list` printed. */
const DRONE_ARGUMENT = { name: 'drone-id', summary: 'the id of the drone, as mechane drone list prints it' } as const;

/** The input of a command on one drone of a mech. */
const DroneCommandInput = renamedWireStruct({
  fields: { mechId: RecordId, droneId: DroneId },
  renames: { mechId: 'mech-id', droneId: 'drone-id' },
});

/** The commands that show the threads a mech keeps and the drones it starts on them, and cancel a drone. */
export const DRONE_COMMANDS = {
  'thread list': {
    summary: 'list the threads a mech opened, oldest first, each with its state and its note',
    shape: CommandShape.Document,
    operations: ['listWorkspaces', 'listThreads'],
    flags: {},
    arguments: [MECH_ARGUMENT],
    input: MechCommandInput,
  },
  'drone list': {
    summary: 'list the drones a mech started, oldest first, each with its thread and how it ended',
    shape: CommandShape.Document,
    operations: ['listWorkspaces', 'listDrones'],
    flags: {},
    arguments: [MECH_ARGUMENT],
    input: MechCommandInput,
  },
  'drone show': {
    summary: 'show one drone of a mech: its outcome, its brief, and each model request it reserved, as turn show does',
    shape: CommandShape.Document,
    operations: ['listWorkspaces', 'showDrone'],
    flags: {},
    arguments: [MECH_ARGUMENT, DRONE_ARGUMENT],
    input: DroneCommandInput,
  },
  'drone cancel': {
    summary: 'cancel a running drone of a mech: it ends unreported, canceled, and its mech receives an item saying so',
    shape: CommandShape.Document,
    operations: ['listWorkspaces', 'cancelDrone'],
    flags: {},
    arguments: [MECH_ARGUMENT, DRONE_ARGUMENT],
    input: DroneCommandInput,
  },
} as const satisfies Readonly<Record<string, CommandDeclaration>>;
