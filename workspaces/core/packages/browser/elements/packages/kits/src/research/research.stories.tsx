import type { Meta, StoryObj } from '@storybook/react-vite';
import * as stylex from '@stylexjs/stylex';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { ScatterPlot } from '../../../charts/src/cartesian/index.ts';
import { SparkCell } from '../../../charts/src/cells/index.ts';
import { Metric, MetricGrid } from '../../../collections/src/index.ts';
import { TextMatch } from '../../../content/src/index.ts';
import { Stack, Text } from '../../../core/src/index.ts';
import { fromText, TokenInput } from '../../../forms/src/index.ts';
import { colors, spacing } from '../../../foundations/src/tokens.stylex.ts';
import { FigureGrid } from '../../../layout/src/index.ts';
import { FindingCard } from './finding-card.tsx';
import { MilestonePath } from './milestone-path.tsx';
import type { ResearchMilestone } from './milestone-path.tsx';
import { SpecimenDiff } from './specimen-diff.tsx';
import type { SpecimenDiffRow, SpecimenFilter } from './specimen-diff.tsx';
import { WorkHeartbeat } from './work-heartbeat.tsx';
import type { WorkReportItem } from './work-heartbeat.tsx';

const meta = {
  title: 'Kits/Research',
  component: MilestonePath,
  subcomponents: { FindingCard, SpecimenDiff, WorkHeartbeat },
  parameters: {
    docs: {
      description: {
        component:
          'Components for tracking scientific research progression: MilestonePath renders branching breakthroughs and falsified counterexamples; SpecimenDiff pairs before/after examples beside an outcome flip bar; WorkHeartbeat shows active checkpoint freshness; FindingCard frames claims, limitations, metrics, and hover-previewable citations. All data here is synthetic.',
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj;

const LOCALE = 'en-US';

const styles = stylex.create({
  page: { display: 'grid', gap: spacing.xxl, maxWidth: 1120, minWidth: 0, color: colors.ink },
});

const syntheticMilestones: ReadonlyArray<ResearchMilestone> = [
  {
    id: 'w0-base',
    parentId: null,
    label: 'Raw readout baseline',
    kind: 'baseline',
    wave: 'W0',
    metric: 0.426,
    claim: 'Raw residual-stream projection establishes the zero-weight reference across 204 held-in questions.',
    limitation: 'Blind inside mid-depth loop passes before the final readout block.',
    source: 'run-w0-baseline',
  },
  {
    id: 'w1-partial',
    parentId: 'w0-base',
    label: 'Partial readout adapter',
    kind: 'breakthrough',
    wave: 'W1',
    metric: 0.529,
    delta: 0.103,
    claim: 'Stopping readout two layers early unpacks intermediate states before final-answer rotation.',
    limitation: 'State-tracking and 3-hop arithmetic remain buried under surface format bias.',
    source: 'run-w1-partial',
  },
  {
    id: 'w1-pmi-dead',
    parentId: 'w0-base',
    label: 'Batch PMI debiasing',
    kind: 'counterexample',
    wave: 'W1',
    metric: 0.477,
    delta: -0.035,
    claim: 'Leave-one-out batch PMI improved fast dev by +0.9% but regressed -3.5% on unseen tasks.',
    limitation: 'Overfits prompt family distribution; closed as a dead lever.',
    source: 'retro-w1',
  },
  {
    id: 'w2-bandpass',
    parentId: 'w1-partial',
    label: '3-Pass bandpass filter',
    kind: 'breakthrough',
    wave: 'W2',
    metric: 0.603,
    delta: 0.074,
    claim: 'Combining contrastive loop deltas with neutral prior removal lifts unseen generalization to 58.1%.',
    limitation: '12.6% gap remains below the 48-visit Oracle ceiling (72.9%).',
    source: 'run-w2-bandpass',
  },
  {
    id: 'w2-linear-dead',
    parentId: 'w1-partial',
    label: 'Linear tuned lens',
    kind: 'counterexample',
    wave: 'W2',
    metric: 0.426,
    delta: -0.103,
    claim: 'Affine translator failed to match nonlinear 3-layer partial readout.',
    limitation: 'Proves workspace de-rotation requires nonlinear MLP layers.',
    source: 'retro-w2',
  },
];

const syntheticSpecimens: ReadonlyArray<SpecimenDiffRow> = [
  {
    id: 'q-014',
    prompt: 'Compute (17 + 8) * 3 without showing work.',
    family: '2hop_arith',
    expected: '25',
    baselineOutput: 'brackets, arithmetic, x',
    candidateOutput: '25, seventy, 75',
    outcome: 'gained',
  },
  {
    id: 'q-042',
    prompt: 'Translate the capital of the country bordering Peru to French.',
    family: 'multilingual_bridge',
    expected: 'Brasilia',
    baselineOutput: 'Brasilia, Lima, South',
    candidateOutput: 'Brasilia, Brésil, Lima',
    outcome: 'both_pass',
  },
  {
    id: 'q-088',
    prompt: 'Alice gives Bob 2 coins, Bob gives Carol 1. Who holds the fewest?',
    family: 'state_tracking',
    expected: 'Carol',
    baselineOutput: 'Carol, Bob, Alice',
    candidateOutput: 'Bob, Alice, coins',
    outcome: 'regressed',
  },
  {
    id: 'q-103',
    prompt: 'Track 4 box swaps starting from [A, B, C, D] and name slot 2.',
    family: 'state_tracking',
    expected: 'C',
    baselineOutput: 'slot, box, swap',
    candidateOutput: 'box, D, A',
    outcome: 'both_fail',
  },
];

const syntheticWork: ReadonlyArray<WorkReportItem> = [
  {
    id: 'job-modal-harvest',
    title: 'Modal H100 activation harvest (Wave 3)',
    state: 'running',
    observedAt: '2026-11-24T04:18:00Z',
    observedLabel: '32s ago',
    executionRef: 'modal:scott-73859/w3-j-lens',
    nextCheckpoint: 'After dev_unseen (86 Qs) finishes',
    progress: { completed: 2, total: 3, unit: 'banks' },
  },
  {
    id: 'job-ndif-parity',
    title: 'NDIF local parity check (practice)',
    state: 'completed',
    observedAt: '2026-11-24T04:10:00Z',
    observedLabel: '8m ago',
    executionRef: 'ndif:practice-10q',
  },
];

function ResearchWorkspaceStory(): ReactNode {
  const [selectedMilestone, setSelectedMilestone] = useState<string | null>('w2-bandpass');
  const [filter, setFilter] = useState<SpecimenFilter>('all');
  const [tokens, setTokens] = useState(() => fromText('wave=2 split=dev_unseen'));

  return (
    <div {...stylex.props(styles.page)}>
      <MetricGrid layout="columns">
        <Metric
          variant="statistic"
          label="Best unseen OOS"
          value="58.1%"
          change={{ value: '+20.9% vs starter', tone: 'positive' }}
          detail="50/86 · w2_koopman_g0.5_dedup"
          target="Oracle-48 ceiling: 67.4%"
          trend={
            <SparkCell
              points={[0.372, 0.477, 0.512, 0.558, 0.581]}
              domain={[0, 1]}
              locale={LOCALE}
              format={{ style: 'percent', maximumFractionDigits: 1 }}
              tone="positive"
              label="peak"
            />
          }
        />
        <Metric
          variant="statistic"
          label="Combined dev_full"
          value="60.3%"
          change={{ value: '+17.7% vs starter', tone: 'positive' }}
          detail="123/204 · 3-pass bandpass"
          target="Holdout: 89 Qs sealed"
        />
      </MetricGrid>

      <FigureGrid layout="hero-aside">
        <ScatterPlot
          title="Generalization: dev_fast vs unseen OOS"
          description="Arms above or on the dashed diagonal transfer cleanly to unseen questions."
          locale={LOCALE}
          points={[
            { id: 'starter', label: 'Starter', x: 0.466, y: 0.372, tone: 'series5' },
            { id: 'pmi', label: 'Batch PMI', x: 0.551, y: 0.477, tone: 'negative' },
            { id: 'w1', label: 'W1 Partial-Coda', x: 0.542, y: 0.512, tone: 'series1' },
            { id: 'w2', label: 'W2 Bandpass', x: 0.644, y: 0.581, tone: 'positive' },
          ]}
          x={{ label: 'dev_fast', domain: [0.3, 0.75], format: { style: 'percent', maximumFractionDigits: 0 } }}
          y={{ label: 'dev_unseen OOS', domain: [0.3, 0.75], format: { style: 'percent', maximumFractionDigits: 0 } }}
          referenceDiagonal={{ label: 'y = x', aboveLabel: 'Stronger OOS', belowLabel: 'Overfits dev_fast' }}
          referenceLines={[{ id: 'oracle', label: 'Oracle ceiling', value: 0.674, tone: 'series3' }]}
          frontier={['starter', 'w1', 'w2']}
          labeledIds={['starter', 'pmi', 'w1', 'w2']}
        />
        <WorkHeartbeat reports={syntheticWork} locale={LOCALE} />
      </FigureGrid>

      <MilestonePath
        title="Research progression & falsified levers"
        description="Synthetic branching progression from Wave 0 baseline through Wave 2 breakthroughs."
        locale={LOCALE}
        milestones={syntheticMilestones}
        valueLabel="dev_full pass rate"
        valueFormat={{ style: 'percent', maximumFractionDigits: 1 }}
        deltaFormat={{ style: 'percent', maximumFractionDigits: 1, signDisplay: 'exceptZero' }}
        selected={selectedMilestone}
        onSelectedChange={(id) => setSelectedMilestone(id)}
      />

      <SpecimenDiff
        title="Paired specimen flips"
        description="Wave 2 Bandpass compared against Wave 1 Partial-Coda on synthetic questions."
        locale={LOCALE}
        rows={syntheticSpecimens}
        baselineLabel="W1 Partial-Coda"
        candidateLabel="W2 Bandpass"
        filter={filter}
        onFilterChange={setFilter}
      />

      <FigureGrid layout="2-up">
        <FindingCard
          title="Partial-Coda de-rotates core loop states"
          index="A"
          status="supported"
          locale={LOCALE}
          claim="Passing core states through layers 18–20 lifts core gold hits 7× while stopping before final-answer rotation."
          limitation="Requires nonlinear readout; affine Tuned Lens failed to match."
          metrics={[
            {
              label: 'dev_full',
              value: 0.603,
              format: { style: 'percent', maximumFractionDigits: 1 },
              tone: 'positive',
            },
            {
              label: 'OOS delta',
              value: 0.209,
              format: { style: 'percent', maximumFractionDigits: 1, signDisplay: 'always' },
              tone: 'positive',
            },
          ]}
          author="antigravity"
          recordedAt="2026-11-24T04:20:00Z"
          recordedLabel="2m ago"
          sources={[
            { id: 'w2', label: 'retro-w2', href: '#retro-w2', summary: 'Wave 2 meta-retrospective across 204 Qs' },
          ]}
          details={
            <Text>
              <TextMatch text="Verified on dev_fast (118 Qs) and unseen dev_unseen (86 Qs)." query="dev_unseen" />
            </Text>
          }
        />
        <Stack isCompact>
          <Text variant="caption" tone="muted">
            Structured label TokenInput
          </Text>
          <TokenInput.Root
            value={tokens}
            onValueChange={(next) => setTokens(next)}
            renderToken={(token) => (
              <TokenInput.Token>
                {token.label}
                <TokenInput.TokenRemove />
              </TokenInput.Token>
            )}
          >
            <TokenInput.Editor aria-label="Board labels" placeholder="Add k=v labels…" />
          </TokenInput.Root>
        </Stack>
      </FigureGrid>
    </div>
  );
}

export const ResearchControlRoom: Story = { render: () => <ResearchWorkspaceStory /> };
