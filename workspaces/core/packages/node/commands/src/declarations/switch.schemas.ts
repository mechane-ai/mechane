import { Effect, Schema } from 'effect';

/** Omitted command switches decode to false before the command is dispatched. */
export const OptionalSwitch = Schema.Boolean.pipe(Schema.withDecodingDefaultKey(Effect.succeed(false)));

export type OptionalSwitch = typeof OptionalSwitch.Type;
