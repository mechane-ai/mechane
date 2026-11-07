import { wireStruct } from '@mechane/records';
import { Schema } from 'effect';

/** Guest capabilities let a newer Worker preserve the released protocol while an older machine drains. */
export const GuestCapabilities = wireStruct({ fields: { isCheckpointSupported: Schema.Literal(true) } });

export type GuestCapabilities = typeof GuestCapabilities.Type;
