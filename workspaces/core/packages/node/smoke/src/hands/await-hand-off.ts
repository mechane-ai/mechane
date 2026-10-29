import { LogEvent } from '@mechane/protocol';
import type { LogLine } from '@mechane/protocol';
import type { Stack } from '@mechane/stack';
import { awaitLogged } from '@mechane/testing';
import type { ScenarioFailure, TalkingMech } from '@mechane/testing';
import { Effect, Option } from 'effect';

/** The stack, and the mech whose alarm the scenario waits to see hand pi on. */
type HandOffInput = { readonly stack: Stack; readonly mech: TalkingMech };

/** The Worker's lines a wait reads. */
type LinesInput = { readonly lines: ReadonlyArray<LogLine> };

/** Waits until the Worker logged an alarm of the mech that handed pi on to the next alarm. */
export const awaitHandOff = Effect.fn('awaitHandOff')(function* ({
  stack,
  mech,
}: HandOffInput): Effect.fn.Return<void, ScenarioFailure> {
  const isHandOff: (line: LogLine) => boolean = (line) =>
    line.event === LogEvent.AlarmHandedOff && Option.contains(line.mechId, mech.id);

  const isLogged: (input: LinesInput) => boolean = ({ lines }) => lines.some(isHandOff);

  yield* awaitLogged({ stack, awaited: `an alarm of mech ${mech.id} handing pi on`, isLogged });
});
