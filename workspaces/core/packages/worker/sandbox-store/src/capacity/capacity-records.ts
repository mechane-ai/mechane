import { Sequence } from '@mechane/records';
import { SandboxOwner } from '@mechane/sandbox-wire';
import { decodeFirst, decodeOne } from '@mechane/store';
import type { RecordsInput } from '@mechane/store';
import { Option, Schema } from 'effect';
import { MachineIdRow } from '../schemas.ts';

/** Durable intent before allocation and confirmed stop. */
export const ReservationPhase = { Starting: 'starting', Held: 'held', Stopping: 'stopping' } as const;

export type ReservationPhase = (typeof ReservationPhase)[keyof typeof ReservationPhase];

/** The increasing reservation number fences delayed acquisition and release across machine replacement. */
export const MachineReservation = Schema.Struct({
  reservationId: Schema.Int,
  machineId: MachineIdRow.fields.id,
  phase: Schema.Enum(ReservationPhase),
});

export type MachineReservation = typeof MachineReservation.Type;

const OwnerJson = Schema.fromJsonString(SandboxOwner);
const ReservationJson = Schema.fromJsonString(MachineReservation);
const OptionalReservation = Schema.OptionFromNullOr(ReservationJson);
const CapacityRow = Schema.Struct({ owner: OwnerJson, reservation: OptionalReservation });
type CapacityRow = typeof CapacityRow.Type;
const ReservationSequence = Schema.Struct({ sequence: Sequence });
type ReservationSequence = typeof ReservationSequence.Type;

/** The trusted owner and the durable intent of the one capacity reservation this sandbox holds. */
export function capacityRecords({ sql }: RecordsInput) {
  function capacity(): Option.Option<CapacityRow> {
    const cursor = sql.exec('SELECT owner, reservation FROM sandbox_capacity WHERE slot = 1');

    return decodeFirst({ cursor, schema: CapacityRow });
  }

  function bindCapacity({ owner, reservation }: CapacityRow): void {
    const encodedOwner = Schema.encodeSync(OwnerJson)(owner);
    const encodedReservation = Schema.encodeSync(OptionalReservation)(reservation);
    const sequence = Option.match(reservation, { onNone: () => 0, onSome: (held) => held.reservationId });

    sql.exec(
      'INSERT INTO sandbox_capacity (slot, owner, reservation, sequence) VALUES (1, ?, ?, ?) ON CONFLICT DO NOTHING',
      encodedOwner,
      encodedReservation,
      sequence,
    );
  }

  function saveReservation({ reservation }: Pick<CapacityRow, 'reservation'>): void {
    const encoded = Schema.encodeSync(OptionalReservation)(reservation);

    sql.exec('UPDATE sandbox_capacity SET reservation = ? WHERE slot = 1', encoded);
  }

  function nextReservation(): Sequence {
    const cursor = sql.exec('UPDATE sandbox_capacity SET sequence = sequence + 1 WHERE slot = 1 RETURNING sequence');

    return decodeOne({ cursor, schema: ReservationSequence }).sequence;
  }

  return { capacity, bindCapacity, saveReservation, nextReservation };
}
