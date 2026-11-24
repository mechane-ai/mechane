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
import { BarChart, Sparkline } from '../../../charts/src/cartesian/index.ts';
import { Button } from '../../../core/src/index.ts';
import { colors, spacing, typography } from '../../../foundations/src/tokens.stylex.ts';
import type { LessonValuesChangeDetails } from '../lesson/lesson-store.ts';
import { ParamSlider } from '../lesson/param-controls.tsx';
import { Param, Value } from '../lesson/param.tsx';
import { Playback } from '../lesson/playback.tsx';
import { useLesson } from '../lesson/use-lesson.ts';
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
  shell: {
    display: 'grid',
    gridTemplateColumns: { 'default': 'minmax(0, 1fr)', '@media (min-width: 720px)': '200px minmax(0, 1fr)' },
    columnGap: spacing.xl,
    alignItems: 'start',
  },
  rail: {
    display: 'grid',
    gap: spacing.xxs,
    position: { 'default': 'static', '@media (min-width: 720px)': 'sticky' },
    insetBlockStart: spacing.xl,
    marginBlockEnd: spacing.xl,
    color: colors.muted,
    fontFamily: typography.fontFamily,
    fontSize: typography.bodySize,
  },
  railHeading: { margin: 0, color: colors.ink, fontWeight: typography.strongWeight },
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

/** A host's own rail lists the beats and holds the beat, so the article leaves its contents list out at every width. */
function HostNavigationEssay(): ReactNode {
  const [beat, setBeat] = useState<string>('scores');

  return (
    <div {...stylex.props(styles.page, styles.shell)}>
      <nav aria-label="Lesson" {...stylex.props(styles.rail)}>
        <p {...stylex.props(styles.railHeading)}>Lesson</p>
        {temperatureLesson.beats.map((item) => (
          <Button
            key={item.id}
            variant={item.id === beat ? 'outline' : 'ghost'}
            density="compact"
            aria-current={item.id === beat ? 'location' : undefined}
            onClick={() => setBeat(item.id)}
          >
            {item.title}
          </Button>
        ))}
      </nav>
      <Article
        lesson={temperatureLesson}
        locale="en-US"
        title="What a softmax temperature does"
        tones={temperatureTones}
        math={standInMath}
        hasContents={false}
        lessonProps={{ beat, onBeatChange: (next) => next !== null && setBeat(next) }}
      >
        {temperatureEssay}
      </Article>
    </div>
  );
}

export const HostNavigation: Story = { render: () => <HostNavigationEssay /> };

/** Puts the temperature back to where the beat opened, and nothing else. */
function ResetScores(): ReactNode {
  const { resetBeat } = useLesson(temperatureLesson);

  return (
    <Button
      variant="ghost"
      density="compact"
      onClick={(event) => resetBeat('scores', { reason: 'reset', event: event.nativeEvent })}
    >
      Reset
    </Button>
  );
}

/** The four probabilities as a report chart, whose own frame stands in for the figure's. */
function ReportBars(): ReactNode {
  const { values, locale } = useLesson(temperatureLesson);

  return (
    <BarChart
      title="Next-token probabilities"
      description="Synthetic scores after the softmax."
      report={{
        meta: (
          <>
            T = <Value name="temperature" />
          </>
        ),
      }}
      locale={locale}
      categories={[{ id: 'top', label: 'Paris' }]}
      series={[{ id: 'probability', label: 'Probability', tone: 'series1', values: [values.top] }]}
      domain={[0, 1]}
      valueFormat={{ style: 'percent', maximumFractionDigits: 1 }}
      valueLabel="Probability"
      height="compact"
    />
  );
}

/** Figures in a hairline frame, with controls in a strip above or below the visual, or framed with no strip. */
const framedEssay = (
  <Beat id="scores">
    <p>
      The temperature is <Param name="temperature" />. The figure keeps its own slider above the chart and a reset below
      it, inside one frame.
    </p>
    <Figure
      id="framed-bars"
      caption="Paris’s probability at the current temperature."
      description="One bar, taller at low temperatures."
      reads={['temperature']}
      header={<ParamSlider name="temperature" />}
      footer={<ResetScores />}
    >
      <TemperatureBar />
    </Figure>
    <Figure
      id="framed-report"
      caption="The same probability, as a report chart in a framed figure: one border, not two."
      description="One bar in a bordered report."
      reads={['temperature']}
      footer={<ResetScores />}
    >
      <ReportBars />
    </Figure>
    <Figure
      id="framed-trend"
      caption="A figure with no controls, framed so it matches the figures above."
      description="A line that falls from 1.6 to 0.4 over six steps."
      isFramed
    >
      <Sparkline
        title="Loss over six steps"
        summary="Six synthetic observations fall from 1.6 to 0.4."
        unit="nats"
        timestampUnit="seconds"
        series={{
          id: 'loss',
          label: 'Loss',
          tone: 'series1',
          points: [1.6, 1.1, 0.8, 0.6, 0.5, 0.4].map((value, index) => ({ timestamp: index, value })),
        }}
        valueDomain={[0, 2]}
        markedPoints={['last']}
        layout="figure"
      />
    </Figure>
  </Beat>
);

/** The plain bar of Paris's probability, for the framed figure. */
function TemperatureBar(): ReactNode {
  const { values, locale } = useLesson(temperatureLesson);

  return (
    <BarChart
      title="Paris’s probability"
      description="Synthetic scores after the softmax."
      locale={locale}
      categories={[{ id: 'top', label: 'Paris' }]}
      series={[{ id: 'probability', label: 'Probability', tone: 'series1', values: [values.top] }]}
      domain={[0, 1]}
      valueFormat={{ style: 'percent', maximumFractionDigits: 1 }}
      valueLabel="Probability"
      height="compact"
    />
  );
}

export const FramedFigures: Story = {
  render: () => (
    <div {...stylex.props(styles.page, styles.stack)}>
      <Article lesson={temperatureLesson} locale="en-US" title="Framed figures">
        {framedEssay}
      </Article>
      <Article lesson={temperatureLesson} locale="en-US" title="Framed figures, static" view="static">
        {framedEssay}
      </Article>
    </div>
  ),
};

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
