import type { Meta, StoryObj } from '@storybook/react-vite';
import * as stylex from '@stylexjs/stylex';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { AgentPanel } from '../../../../src/stories/agent-panel.tsx';
import {
  standInMath,
  temperatureEssay,
  temperatureLesson,
  temperatureTones,
} from '../../../../src/stories/temperature-essay.tsx';
import { spacing } from '../../../foundations/src/tokens.stylex.ts';
import type { LessonValuesChangeDetails } from '../lesson/lesson-store.ts';
import { Param } from '../lesson/param.tsx';
import { Playback } from '../lesson/playback.tsx';
import type { ArticleView } from './article-context.ts';
import { Article } from './article.tsx';
import { Beat } from './beat.tsx';
import { Challenge } from './challenge.tsx';
import { Figure, FigureReference, Reveal } from './figure.tsx';
import { Cite } from './notes.tsx';
import { Predict } from './predict.tsx';
import { Scrolly, ScrollyStep } from './scrolly.tsx';

const meta = {
  title: 'Teaching/Article',
  component: Article,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Article renders one lesson as an essay of beats: prose with live values, numbered figures, exercises, asides, notes and references. The same children read as a scrolling essay, a presentation, a static page or a beat sheet, chosen by `view`. The author supplies the lesson, the beats in markup, and optionally a TeX typesetter and the tones the figures share; the essay here is synthetic.',
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj;

const styles = stylex.create({
  page: { paddingBlock: spacing.xl, paddingInline: spacing.lg },
  stack: { display: 'grid', gap: spacing.xxl },
});

function Essay({
  view,
  children,
  onValuesChange,
}: {
  readonly view: ArticleView;
  readonly children?: ReactNode;
  readonly onValuesChange?: ((details: LessonValuesChangeDetails) => void) | undefined;
}): ReactNode {
  return (
    <div {...stylex.props(styles.page)}>
      <Article
        lesson={temperatureLesson}
        locale="en-US"
        title="What a softmax temperature does"
        authors={['A. Researcher', 'An agent']}
        date="2026-11-23"
        summary="One number divides every score before the softmax. Turn it and watch confidence trade against spread, in five short beats with synthetic scores."
        tones={temperatureTones}
        math={standInMath}
        view={view}
        lessonProps={{ onValuesChange: (_values, details) => onValuesChange?.(details) }}
      >
        {temperatureEssay}
      </Article>
      {children}
    </div>
  );
}

export const Default: Story = { render: () => <Essay view="article" /> };

export const Present: Story = { render: () => <Essay view="present" /> };

export const Static: Story = { render: () => <Essay view="static" /> };

/** The present view moved by an agent: the values each slide shows report the agent as their source. */
function AgentPresentEssay(): ReactNode {
  const [last, setLast] = useState('No values change yet.');

  return (
    <Essay view="present" onValuesChange={(details) => setLast(`${details.reason}, from ${details.source}`)}>
      <AgentPanel ask="Ask the agent for the next step" steps={[{ ref: temperatureLesson.title, action: 'next' }]} />
      <p aria-label="Last values change">{last}</p>
    </Essay>
  );
}

export const AgentPresent: Story = { render: () => <AgentPresentEssay /> };

/** An agent plays the training run through the bridge: the run moves, yet the challenge on its beat stays open. */
export const AgentPlay: Story = {
  render: () => (
    <Essay view="article">
      <AgentPanel
        ask="Ask the agent to play the training run"
        steps={[{ ref: temperatureLesson.title, action: 'play', args: ['trainStep'] }]}
      />
    </Essay>
  ),
};

export const Sheet: Story = { render: () => <Essay view="sheet" /> };

const choices = [
  { id: 'sharper', label: 'Sharper' },
  { id: 'flatter', label: 'Flatter' },
];

function isNeverReached(): boolean {
  return false;
}

/** An author's own component: the parts inside render, but the outline cannot see them. */
function WrappedParts(): ReactNode {
  return (
    <>
      <Predict
        id="wrapped-guess"
        prompt="A guess inside a component of the author's own."
        options={choices}
        answer="sharper"
      >
        <p>Its answer would reach the tutor, so it does not render.</p>
      </Predict>
      <Figure
        id="wrapped-figure"
        caption="A figure inside a component of the author's own."
        description="A placeholder."
      >
        <p>A chart would be here.</p>
      </Figure>
    </>
  );
}

/** Markup with the mistakes an author or an agent makes, each shown where it happens and listed by the sheet. */
const mistakes = (
  <>
    <Beat id="scores">
      <p>
        A citation of a work the references lack <Cite id="nobody2020" />, a figure that does not exist (
        <FigureReference to="missing-figure" />) and a training step of <Param name="trainStep" /> that no figure reads.
      </p>
      <Reveal at={3}>
        <p>Beat “scores” declares no reveal steps, so step 3 does not exist.</p>
      </Reveal>
      <Predict
        id="loss-guess"
        prompt="Guess the loss."
        min={0}
        max={1}
        step={0.1}
        format={{ maximumFractionDigits: 1 }}
        answerFrom="loss"
      >
        <p>The lesson has no value named loss.</p>
      </Predict>
      <Playback name="trainStep" />
      <Figure id="undescribed" caption="A figure with no description." reads={['temperature']}>
        <p>A chart would be here.</p>
      </Figure>
    </Beat>
    <Beat id="cooling">
      <p>The lesson declares no beat “cooling”.</p>
      <Figure id="scores" caption="A figure named like a beat." description="A placeholder." reads={['temperature']}>
        <p>Its id is also the id of beat “scores”.</p>
      </Figure>
      <WrappedParts />
      <Scrolly figure={<p>A figure</p>}>
        <ScrollyStep id="freezing" state="frozen">
          <p>No beat declares a state “frozen”.</p>
        </ScrollyStep>
      </Scrolly>
    </Beat>
    <Challenge id="stray" prompt="A challenge outside every beat." isReached={isNeverReached}>
      <p>The sheet lists it.</p>
    </Challenge>
  </>
);

export const AuthorErrors: Story = {
  render: () => (
    <div {...stylex.props(styles.page, styles.stack)}>
      <Article lesson={temperatureLesson} locale="en-US" title="An essay with mistakes">
        {mistakes}
      </Article>
      <Article lesson={temperatureLesson} locale="en-US" title="An essay with mistakes" view="sheet">
        {mistakes}
      </Article>
    </div>
  ),
};
