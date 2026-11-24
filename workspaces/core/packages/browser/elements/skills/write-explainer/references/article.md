# Article and views

Import from `@mechane-ai/elements/article`. An `Article` renders a lesson as beats of prose, figures and exercises, and
arranges the same children four ways. It renders the `Lesson`, a `ChartLink` and a `ToneScope` for you.

## `Article`

| Prop                                              | What it does                                                                           |
| ------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `lesson`, `locale`, `title`                       | Required.                                                                              |
| `authors`, `date`, `summary`                      | The byline, an ISO date, and a sentence or two on what the reader will learn.          |
| `tones`                                           | The tone of each id the figures and terms share, declared once.                        |
| `view`                                            | `'article'` (default), `'present'`, `'static'` or `'sheet'`.                           |
| `math`                                            | `(tex, { isDisplay }) => ReactNode`, the application's typesetter.                     |
| `storageKey`                                      | Keeps the values and the reader's progress across visits.                              |
| `progress`, `defaultProgress`, `onProgressChange` | The reader's predictions, challenges, hints and visits, if the application holds them. |
| `lessonProps`                                     | Passed to the `Lesson`: controlled values, beat and step, `shouldSyncUrl`.             |
| `labels`                                          | The article's own words, with English defaults.                                        |

## Markup the article reads

The article walks the markup you write to find beats, figures, players and prose params. It does not render your own
components to look inside them. So:

- Write `Beat`, `Figure`, `Param`, `Playback`, `Transport`, `Predict`, `Challenge`, `Footnote` and `References` in the
  article's children or in the MDX file, not inside a component of your own. Plain elements and fragments are fine, so
  the beats can be one exported fragment that `articleOutline` also reads. A `Beat`, `Figure`, `Predict` or `Challenge`
  inside your own component draws an inline error in its place:
  `Figure "vote-scene" sits inside a component of your own, so the outline, the beat sheet and the tutor miss it. Write it directly in the Article's children.`
- Put each figure's drawing in your component, inside a `Figure`, and list in `reads` every lesson name it reads.
- Every `<Beat id>` names a beat the lesson declares, and every declared beat is rendered once, in order.

## Parts

- `Beat`: `id` and children. Its title, tutor notes, reveal steps and states come from the lesson.
- `Figure`: `id` (unique, and different from every beat id), `caption`, `description` (the figure in words, printed in
  the static view), `reads`, `size` (`'wide'`, the default, reaches into the margin; `'text'` keeps the column).
- `FigureReference`: `to`, a figure id. Writes "Figure 2" as a link. Never write a figure number by hand.
- `Reveal`: `at`, a reveal step from 0 up to the beat's declared `steps`. It hides content only in the present view; the
  other views show everything. `useRevealed(at)` gives the same answer to a figure that reveals its own parts: true in
  the article, static and sheet views and outside a beat, and following the beat's step in the present view.
- `Scrolly`: a sticky `figure` beside `ScrollyStep`s; each step has an `id` and sets `values` or a beat `state` while it
  is in view. Use it when reading on should change the picture; use controls when the reader should drive.
- `Predict`: `id`, `prompt`, the explanation as children, and either `options` with an `answer` id, or `min`, `max`,
  `step`, `format` with an `answer` or an `answerFrom` (a lesson value read when the reader commits) and `tolerance`.
  The answer stays hidden, from the reader and from agents, until the reader commits.
- `Challenge`: `id`, `prompt`, `isReached(values)` reading params and derived values by name, `hints`, and the outcome
  as children. Only the reader's own changes reach it; an agent's never do.
- `Term`: `inspects` (an id the figures use) and words. Pointing at it or focusing it marks that object in every figure.
- `DiagramPart`: `inspects` and `label` around hand-drawn SVG shapes, linking them to the figures both ways. Prefer a
  scene part.
- `Aside` (a margin note), `Footnote` (`id`, one sentence), `Cite` (`id` of a reference), and one `References` with
  `items` of `{ id, authors, title, year, venue?, url? }` after the last beat.
- `TeX`: TeX source as its child string, `isDisplay` for a block. Without a `math` prop on `Article` it shows its
  source.

One beat as a fragment (the rest of the lesson's beats would follow it):

```tsx
import {
  Article,
  Aside,
  Beat,
  Cite,
  Figure,
  FigureReference,
  Footnote,
  TeX,
  Predict,
  References,
} from '@mechane-ai/elements/article';
import type { ArticleMath, ArticleView } from '@mechane-ai/elements/article';
import { Value } from '@mechane-ai/elements/lesson';
import type { ReactNode } from 'react';
import { ConfidenceScene } from './figures.tsx';
import { lesson } from './lesson.ts';

export function BiasArticle({ view, math }: { readonly view: ArticleView; readonly math: ArticleMath }): ReactNode {
  return (
    <Article
      lesson={lesson}
      locale="en-US"
      title="A neuron is a weighted vote"
      authors={['A. Researcher']}
      date="2026-11-24"
      view={view}
      math={math}
      lessonProps={{ shouldSyncUrl: true }}
    >
      <Beat id="bias">
        <p>
          The neuron turns its sum into a chance with the sigmoid, <TeX>{String.raw`\sigma(s) = 1 / (1 + e^{-s})`}</TeX>
          <Cite id="rosenblatt1958" />. At the current sum it says yes with a chance of <Value name="yes" /> (
          <FigureReference to="confidence" />
          ).
          <Footnote id="sigmoid">A perceptron used a hard step instead; the sigmoid is its smooth version.</Footnote>
        </p>
        <Predict
          id="zero-sum"
          prompt="At a weighted sum of exactly zero, how sure is the neuron?"
          min={0}
          max={1}
          step={0.05}
          format={{ style: 'percent', maximumFractionDigits: 0 }}
          answer={0.5}
          tolerance={0.05}
        >
          <p>The sigmoid of zero is one half: no evidence either way.</p>
        </Predict>
        <Figure
          id="confidence"
          caption="The sigmoid turns the sum into a chance."
          description="An S-shaped curve of the chance of yes against the bias, with a point at the current bias."
          reads={['sum', 'yes', 'bias']}
          size="text"
        >
          <ConfidenceScene />
        </Figure>
        <Aside>Real networks use many activation functions; the sigmoid is the oldest.</Aside>
      </Beat>
      <References
        items={[
          {
            id: 'rosenblatt1958',
            authors: ['Frank Rosenblatt'],
            title: 'The perceptron: a probabilistic model for information storage and organization in the brain',
            year: 1958,
            venue: 'Psychological Review',
          },
        ]}
      />
    </Article>
  );
}
```

## The four views

The same children, arranged four ways. In the essay starter, `?view=present`, `?view=static` and `?view=sheet` choose
one.

| View      | What it is                                                                                                                                                                                                                                                                 |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `article` | The scrolling essay, with a contents list that follows the reading position and sets the lesson's beat.                                                                                                                                                                    |
| `present` | One beat at a time, opened at its first declared state each time the presenter reaches it. Right or Space runs `next` (the next reveal step, then the next beat); Left goes back. A `Scrolly` shows its figure beside its steps, which are walked before the reveal steps. |
| `static`  | Every beat open at its first state, every reveal shown, each figure followed by its description, no motion.                                                                                                                                                                |
| `sheet`   | Every beat at each of its states, read-only and scaled to fit its cell, with its tutor notes, then "Checks".                                                                                                                                                               |

The sheet's checks, and what each means:

| Check                                                  | Fix                                                  |
| ------------------------------------------------------ | ---------------------------------------------------- |
| The lesson declares a beat the article does not render | Add the `<Beat>`, or remove the beat from the lesson |
| The article renders a beat the lesson does not declare | Declare it, or fix the id                            |
| A beat has no figure                                   | Give it one, or fold it into the beat before         |
| A figure has no description                            | Write the figure in words                            |
| Two parts share an element id                          | Rename one (beats, figures, footnotes, references)   |
| A `Predict` or `Challenge` sits outside every `Beat`   | Move it into the beat it belongs to                  |
| A `Playback` has no `Transport`                        | Add `<Transport for>` the reader can reach           |
| A `Param` in the prose changes no figure of its beat   | Name it in a figure's `reads`, or move the control   |

`articleChecks(lesson, articleOutline(children))` returns the same list as data, for a test page or an agent. The
outline also lists the essay's `predictions` and `challenges`; `answerSources(outline)` turns its predictions into the
`answers` a tutor needs (see the [tutor reference](tutor.md)).
