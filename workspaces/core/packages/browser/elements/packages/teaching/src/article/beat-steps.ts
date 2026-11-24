import type { ArticleView } from './article-context.ts';
import type { ArticleOutline, OutlineBeat } from './outline-types.ts';

/** Where a beat stands at a lesson step: the scrolly step it shows, if any, and its reveal step. */
export type BeatPlace = { readonly scrolly: number | null; readonly reveal: number };

/**
 * Splits a lesson step into a scrolly step and a reveal step. In the present view a beat walks its scrolly steps first,
 * then its declared reveal steps; the other views count reveal steps alone, since scrolling walks a scrolly.
 */
export function beatPlace({
  beat,
  step,
  view,
}: {
  readonly beat: OutlineBeat | undefined;
  readonly step: number;
  readonly view: ArticleView;
}): BeatPlace {
  const count = view === 'present' ? (beat?.scrollySteps.length ?? 0) : 0;

  return count === 0
    ? { scrolly: null, reveal: step }
    : { scrolly: Math.min(step, count - 1), reveal: Math.max(0, step - (count - 1)) };
}

/** The steps each beat's scrollies add to the lesson: one fewer than they have, as step 0 shows one. */
export function scrollyAddedSteps(outline: ArticleOutline): Readonly<Record<string, number>> {
  return Object.fromEntries(
    outline.beats.flatMap((beat) =>
      beat.scrollySteps.length > 1 ? [[beat.id, beat.scrollySteps.length - 1] as const] : [],
    ),
  );
}
