import type { AnyLesson } from '../lesson/define-lesson.ts';
import type { ArticleOutline } from './outline-types.ts';

/** One problem a beat sheet finds in an article: the beat it concerns, when there is one, and a sentence. */
export type ArticleFinding = { readonly beat: string | null; readonly message: string };

/** Every value `name` depends on: itself, and for a derived value each value it reads, through other derived values. */
function upstream(lesson: AnyLesson, name: string): ReadonlySet<string> {
  const reads = new Map(Object.entries(lesson.reads));
  const walk: { found: ReadonlySet<string>; size: number } = { found: new Set([name]), size: 0 };

  while (walk.found.size !== walk.size) {
    walk.size = walk.found.size;
    walk.found = new Set([...walk.found, ...[...walk.found].flatMap((item) => reads.get(item) ?? [])]);
  }

  return walk.found;
}

function beatFindings(lesson: AnyLesson, outline: ArticleOutline): ReadonlyArray<ArticleFinding> {
  const declared = new Set(lesson.beats.map((beat) => beat.id));
  const rendered = new Set(outline.beats.map((beat) => beat.id));

  return [
    ...lesson.beats
      .filter((beat) => !rendered.has(beat.id))
      .map((beat) => ({
        beat: beat.id,
        message: `The lesson declares beat "${beat.id}", which the article does not render.`,
      })),
    ...outline.beats
      .filter((beat) => !declared.has(beat.id))
      .map((beat) => ({
        beat: beat.id,
        message: `The article renders beat "${beat.id}", which the lesson does not declare.`,
      })),
    ...outline.beats
      .filter((beat) => beat.figures.length === 0)
      .map((beat) => ({ beat: beat.id, message: `Beat "${beat.id}" has no figure.` })),
  ];
}

function figureFindings(outline: ArticleOutline): ReadonlyArray<ArticleFinding> {
  return outline.beats
    .flatMap((beat) => beat.figures)
    .filter((figure) => !figure.hasDescription)
    .map((figure) => ({ beat: figure.beat, message: `Figure "${figure.id}" has no description.` }));
}

/**
 * The element ids the article's parts give the page, with the part that gives each. A footnote's back link mirrors its
 * note.
 */
function elementIds(outline: ArticleOutline): ReadonlyArray<{ readonly id: string; readonly part: string }> {
  return [
    ...outline.beats.map((beat) => ({ id: beat.id, part: `Beat "${beat.id}"` })),
    ...outline.figures.map((id) => ({ id, part: `Figure "${id}"` })),
    ...outline.footnotes.map((note) => ({ id: `fn-${note.id}`, part: `Footnote "${note.id}"` })),
    ...outline.references.map((item) => ({ id: `ref-${item.id}`, part: `Reference "${item.id}"` })),
  ];
}

/** Two parts that give the page the same element id, so a link or the contents list finds only the first. */
function elementIdFindings(outline: ArticleOutline): ReadonlyArray<ArticleFinding> {
  const owners = Map.groupBy(elementIds(outline), (entry) => entry.id);

  return [...owners].flatMap(([id, entries]) =>
    entries.length === 1
      ? []
      : [
          {
            beat: null,
            message: `${entries.map((entry) => entry.part).join(' and ')} share the element id "${id}". Rename one.`,
          },
        ],
  );
}

function controlFindings(lesson: AnyLesson, outline: ArticleOutline): ReadonlyArray<ArticleFinding> {
  const transports = new Set(outline.transports);

  const players = outline.playbacks
    .filter((player) => !transports.has(player.name))
    .map((player) => ({
      beat: player.beat,
      message: `Playback "${player.name}" has no Transport, so the reader cannot start it.`,
    }));

  const idle = outline.beats.flatMap((beat) => {
    const affecting = new Set(beat.figureNames.flatMap((name) => [...upstream(lesson, name)]));

    return beat.proseParams
      .filter((name) => !affecting.has(name))
      .map((name) => ({
        beat: beat.id,
        message: `Param "${name}" in the prose of beat "${beat.id}" changes no figure of that beat. Name it in a figure's reads.`,
      }));
  });

  return [...players, ...idle];
}

function exerciseFindings(outline: ArticleOutline): ReadonlyArray<ArticleFinding> {
  return [
    ...outline.predictions
      .filter((prediction) => prediction.beat === null)
      .map((prediction) => ({ beat: null, message: `Predict "${prediction.id}" sits outside every Beat.` })),
    ...outline.challenges
      .filter((challenge) => challenge.beat === null)
      .map((challenge) => ({ beat: null, message: `Challenge "${challenge.id}" sits outside every Beat.` })),
  ];
}

/** The problems a beat sheet lists: missing beats, figures or descriptions, players without controls, idle params. */
export function articleChecks(lesson: AnyLesson, outline: ArticleOutline): ReadonlyArray<ArticleFinding> {
  return [
    ...beatFindings(lesson, outline),
    ...figureFindings(outline),
    ...controlFindings(lesson, outline),
    ...exerciseFindings(outline),
    ...elementIdFindings(outline),
  ];
}
