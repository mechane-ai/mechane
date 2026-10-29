import type { ItemEnded, ItemUnanswered } from '@mechane/harness';
import type { MechTables } from '@mechane/mech-store';
import { UnansweredReason } from '@mechane/protocol';
import { Match, Option } from 'effect';
import { unansweredReason } from '../turns/unanswered-reason.ts';
import { DroneEnding } from './schemas.ts';

/** A running drone whose brief pi ended, and how. */
type BriefEndingInput = { readonly store: MechTables; readonly droneId: string; readonly progress: ItemEnded };

/** How a drone ends once pi ended its brief: a drone with a recorded cancel ends canceled whatever pi reports. */
export function briefEnding({ store, droneId, progress }: BriefEndingInput): DroneEnding {
  if (Option.isSome(store.droneCancel({ droneId }))) {
    return DroneEnding.cases.Unreported.make({ reason: UnansweredReason.Canceled });
  }

  const unanswered: (ended: ItemUnanswered) => DroneEnding = ({ failure }) =>
    DroneEnding.cases.Unreported.make({
      reason: unansweredReason({ failure, isRefused: Option.isSome(store.droneRefusal({ droneId })) }),
    });

  return Match.valueTags(progress, {
    Answered: ({ reply }) => DroneEnding.cases.Reported.make({ report: reply }),
    Unanswered: unanswered,
  });
}
