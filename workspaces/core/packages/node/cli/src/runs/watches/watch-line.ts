import type { Watch } from '@mechane/protocol';
import { DateTime, Option } from 'effect';

type WatchLineInput = { readonly watch: Watch };

/** Formats a watch with its next scheduled check and latest outcome. */
export function watchLine({ watch }: WatchLineInput): string {
  const outcome = Option.getOrElse(watch.lastCheckOutcome, () => 'unchecked');

  return `${watch.id}\t${watch.name}\t${watch.status}\tevery ${watch.intervalSeconds}s\tnext ${DateTime.formatIso(watch.nextRunAt)}\tlast ${outcome}`;
}
