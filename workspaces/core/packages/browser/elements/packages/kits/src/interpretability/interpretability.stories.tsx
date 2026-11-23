import type { Meta, StoryObj } from '@storybook/react-vite';
import * as stylex from '@stylexjs/stylex';
import { useState } from 'react';
import type { ReactNode } from 'react';
import type { AttributionEdge, AttributionLayer, AttributionNode } from '../../../charts/src/graph/index.ts';
import { ChartLink } from '../../../charts/src/index.ts';
import type { AttentionToken } from '../../../charts/src/matrix/index.ts';
import { tokenGridCellId } from '../../../charts/src/text/index.ts';
import type { TokenExample, TokenGridCell } from '../../../charts/src/text/index.ts';
import type { DataTableSort } from '../../../collections/src/index.ts';
import { colors, spacing, typography } from '../../../foundations/src/tokens.stylex.ts';
import { AttentionHeadGrid } from './attention-head-grid.tsx';
import type { AttentionHead } from './attention-head-grid.tsx';
import { AttributionWorkbench } from './attribution-workbench.tsx';
import { EmbeddingAtlas } from './embedding-atlas.tsx';
import { FeatureCard } from './feature-card.tsx';
import { FeatureList } from './feature-list.tsx';
import type { FeatureListRow } from './feature-list.tsx';
import type { FeatureCardData } from './features.ts';
import { LogitLens } from './logit-lens.tsx';
import type { LensLayer, LensTrack } from './logit-lens.tsx';
import { SteeringPanel } from './steering-panel.tsx';

const meta = {
  title: 'Kits/Interpretability',
  component: FeatureCard,
  subcomponents: { FeatureList, AttributionWorkbench, AttentionHeadGrid, LogitLens, EmbeddingAtlas, SteeringPanel },
  parameters: {
    docs: {
      description: {
        component:
          'What a mechanistic interpretability team needs to present features, circuits and attention the way research papers and feature browsers do. FeatureCard shows one learned feature: its explanation, activation density, top activating contexts and the tokens it promotes and suppresses. FeatureList browses a dictionary; AttributionWorkbench pairs an attribution graph with the card of the node in focus; AttentionHeadGrid compares heads as small multiples; LogitLens follows a prediction through the layers; EmbeddingAtlas finds features on a map; SteeringPanel shows what the application measured at each steering strength. The application computes every value and holds every selection. All features, prompts and numbers here are synthetic and closed-form.',
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj;

const LOCALE = 'en-US';
const DENSITY_BINS = 16;
const LAYER_COUNT = 12;
const activationFormat = { minimumFractionDigits: 1, maximumFractionDigits: 1 } as const;
const shareFormat = { style: 'percent', maximumSignificantDigits: 2 } as const;
const logitFormat = { minimumFractionDigits: 2, maximumFractionDigits: 2, signDisplay: 'exceptZero' } as const;

const styles = stylex.create({
  page: { display: 'grid', gap: spacing.xxl, maxWidth: 1180, minWidth: 0, color: colors.ink },
  intro: { display: 'grid', gap: spacing.xs, maxWidth: 720 },
  heading: {
    margin: 0,
    fontFamily: typography.fontFamily,
    fontSize: typography.compactHeadingSize,
    lineHeight: typography.compactHeadingLineHeight,
  },
  lede: {
    margin: 0,
    color: colors.muted,
    fontFamily: typography.fontFamily,
    fontSize: typography.bodySize,
    lineHeight: typography.bodyLineHeight,
  },
  cards: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(min(320px, 100%), 1fr))',
    gap: spacing.lg,
    alignItems: 'start',
  },
  states: { display: 'grid', gap: spacing.xxl, maxWidth: 960, minWidth: 0 },
});

/** One synthetic feature: what names it, where it peaks in depth, and the words that light it up. */
type Entry = {
  readonly id: string;
  readonly label: string;
  readonly layer: number;
  readonly explanation: string;
  readonly frequency: number;
  readonly max: number;
  readonly cluster: number;
  readonly sentences: ReadonlyArray<string>;
  /** Activation, as a share of the maximum, of each word the feature responds to. */
  readonly hot: Readonly<Record<string, number>>;
  readonly promotes: ReadonlyArray<string>;
  readonly suppresses: ReadonlyArray<string>;
};

const catalog: ReadonlyArray<Entry> = [
  {
    id: 'f-ggb',
    label: 'Golden Gate Bridge',
    layer: 10,
    explanation:
      'Mentions of the Golden Gate Bridge, and descriptions of it without its name: the red span, the strait.',
    frequency: 0.00031,
    max: 9.6,
    cluster: 0,
    sentences: [
      'We drove across the Golden Gate Bridge at dawn.',
      'The iconic red suspension bridge spans the strait into the bay.',
      'Fog rolled in under the Golden Gate as the ferry left the pier.',
      'Its towers rise 227 metres above the water.',
      'Tourists photograph the bridge from Battery Spencer.',
    ],
    hot: { golden: 0.55, gate: 1, bridge: 0.9, red: 0.5, suspension: 0.7, strait: 0.6, towers: 0.45, spans: 0.4 },
    promotes: [' Bridge', ' Gate', ' span', ' Marin', ' fog', ' Francisco'],
    suppresses: [' Brooklyn', ' Thames', ' Tower', ' London', ' Seine'],
  },
  {
    id: 'f-bridges',
    label: 'Bridges and spans',
    layer: 4,
    explanation: 'The word bridge and other structures that cross water or a gap.',
    frequency: 0.0021,
    max: 6.2,
    cluster: 0,
    sentences: ['The old stone bridge crosses the river.', 'A footbridge spans the ravine below the falls.'],
    hot: { bridge: 1, footbridge: 0.9, spans: 0.6, crosses: 0.5, viaduct: 0.8 },
    promotes: [' over', ' across', ' span', ' river'],
    suppresses: [' tunnel', ' road'],
  },
  {
    id: 'f-gate-word',
    label: 'The word "gate"',
    layer: 4,
    explanation: 'The token gate in any sense: garden gates, airport gates and names that contain it.',
    frequency: 0.0012,
    max: 5.1,
    cluster: 4,
    sentences: ['Please proceed to gate 14 for boarding.', 'She closed the garden gate behind her.'],
    hot: { gate: 1, gates: 0.9, boarding: 0.2 },
    promotes: [' Gate', ' gates', ' agent'],
    suppresses: [' door'],
  },
  {
    id: 'f-place',
    label: 'Located in a place',
    layer: 10,
    explanation: 'The words "is in" and "is located in" after a landmark, where a city or region comes next.',
    frequency: 0.0044,
    max: 4.8,
    cluster: 0,
    sentences: ['The Louvre is located in central Paris.', 'Machu Picchu is in the Andes of Peru.'],
    hot: { in: 1, located: 0.8 },
    promotes: [' Paris', ' the', ' New', ' central'],
    suppresses: [' a', ' very'],
  },
  {
    id: 'f-sf',
    label: 'San Francisco',
    layer: 16,
    explanation: 'San Francisco and the Bay Area: its neighbourhoods, landmarks and the city name split over tokens.',
    frequency: 0.00072,
    max: 8.1,
    cluster: 0,
    sentences: ['We moved to San Francisco in the spring.', 'Cable cars climb the hills above the Mission.'],
    hot: { san: 0.7, francisco: 1, cable: 0.5, mission: 0.6, bay: 0.4 },
    promotes: [' Francisco', ' Bay', ' Oakland', ' Mission'],
    suppresses: [' Diego', ' Antonio', ' Jose'],
  },
  {
    id: 'f-ca',
    label: 'California',
    layer: 16,
    explanation: 'California as a state and places in it.',
    frequency: 0.0016,
    max: 6.7,
    cluster: 0,
    sentences: ['The wildfire season in California starts early.', 'Sacramento is the capital of California.'],
    hot: { california: 1, sacramento: 0.7, wildfire: 0.3 },
    promotes: [' California', ' Los', ' San'],
    suppresses: [' Texas'],
  },
  {
    id: 'f-say-francisco',
    label: 'Say "Francisco"',
    layer: 22,
    explanation: 'Fires just before the model writes Francisco; raises that token directly.',
    frequency: 0.00019,
    max: 7.4,
    cluster: 0,
    sentences: ['The flight lands in San', 'He grew up south of San'],
    hot: { san: 1 },
    promotes: [' Francisco', ' Fran', ' Francis'],
    suppresses: [' Diego', ' Jose', ' Antonio'],
  },
  {
    id: 'f-pydef',
    label: 'Python function definitions',
    layer: 8,
    explanation: 'The def keyword and a function signature in Python source, up to the colon.',
    frequency: 0.0062,
    max: 11.3,
    cluster: 1,
    sentences: ['def parse_args(argv: list[str]) -> Namespace:', 'async def fetch(url, timeout=10):'],
    hot: { def: 1, async: 0.6, parse_args: 0.5, fetch: 0.5 },
    promotes: ['(', ' self', ' __init__', ':'],
    suppresses: [' the', ' and'],
  },
  {
    id: 'f-return',
    label: 'Return statements',
    layer: 8,
    explanation: 'The return keyword and the value that follows, in any language.',
    frequency: 0.0051,
    max: 7.9,
    cluster: 1,
    sentences: ['    return result', '  return x * factor;'],
    hot: { return: 1, result: 0.4 },
    promotes: [' None', ' self', ' result', ' True'],
    suppresses: [' def'],
  },
  {
    id: 'f-indent',
    label: 'Code indentation',
    layer: 2,
    explanation: 'Runs of leading spaces in source code, by nesting depth.',
    frequency: 0.031,
    max: 3.9,
    cluster: 1,
    sentences: ['    for item in items:', '        total += item.price'],
    hot: { for: 0.3, total: 0.3 },
    promotes: [' if', ' for', ' return'],
    suppresses: [' The'],
  },
  {
    id: 'f-neg',
    label: 'Negation',
    layer: 14,
    explanation: 'Words that negate the clause they are in: not, never, no, and the contraction n’t.',
    frequency: 0.0083,
    max: 8.8,
    cluster: 2,
    sentences: [
      'I did not expect the results to hold.',
      'She never answered the second letter.',
      "That isn't what the report says.",
    ],
    hot: { 'not': 1, 'never': 0.95, "isn't": 0.85, 'no': 0.7 },
    promotes: [' only', ' even', ' necessarily', ' yet'],
    suppresses: [' always', ' definitely', ' indeed'],
  },
  {
    id: 'f-quote',
    label: 'Closing quotation marks',
    layer: 6,
    explanation: 'The end of a quoted span of dialogue.',
    frequency: 0.0035,
    max: 5.6,
    cluster: 2,
    sentences: ['"We should leave now," she said.', 'He called it "a small mistake".'],
    hot: { 'now,"': 1, 'mistake".': 0.8 },
    promotes: [' said', ' asked', ' he'],
    suppresses: [' "'],
  },
  {
    id: 'f-dna',
    label: 'DNA sequences',
    layer: 6,
    explanation: 'Strings of nucleotide letters, as in a FASTA file.',
    frequency: 0.0009,
    max: 10.2,
    cluster: 3,
    sentences: ['>chr1 ATGCGTACGTTAGC', 'primer: GGATCCTTAAGC'],
    hot: { atgcgtacgttagc: 1, ggatccttaagc: 0.9 },
    promotes: ['G', 'A', 'TC'],
    suppresses: [' the'],
  },
  {
    id: 'f-french',
    label: 'French text',
    layer: 3,
    explanation: 'Running text in French.',
    frequency: 0.012,
    max: 4.4,
    cluster: 4,
    sentences: ['Nous avons pris le train pour Lyon.', 'Il fait beau aujourd’hui.'],
    hot: { nous: 0.8, avons: 1, pris: 0.7, beau: 0.8 },
    promotes: [' le', ' de', ' et', ' la'],
    suppresses: [' the', ' of'],
  },
  {
    id: 'f-legal',
    label: 'Legal disclaimers',
    layer: 12,
    explanation: 'Boilerplate that limits liability or warranty.',
    frequency: 0.0011,
    max: 6.9,
    cluster: 5,
    sentences: ['THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND.'],
    hot: { warranty: 1, provided: 0.7, without: 0.5 },
    promotes: [' OF', ' ANY', ' EXPRESS'],
    suppresses: [' fun'],
  },
  {
    id: 'f-dates',
    label: 'Calendar dates',
    layer: 5,
    explanation: 'Days, months and years written out or as numbers.',
    frequency: 0.0098,
    max: 5.3,
    cluster: 5,
    sentences: ['The meeting moved to 14 March 2025.', 'Filed on 2024-11-02 at noon.'],
    hot: { 'march': 0.9, '2025': 1, '2024-11-02': 1 },
    promotes: [',', ' 2025', ' at'],
    suppresses: [' dollars'],
  },
];

function sum(values: ReadonlyArray<number>): number {
  const [first = 0, ...rest] = values;

  return values.length === 0 ? 0 : first + sum(rest);
}

function round(value: number, digits = 3): number {
  return Number(value.toFixed(digits));
}

/** Words with their leading space, punctuation on its own, the way a tokenizer of English roughly splits text. */
function tokenize(text: string): ReadonlyArray<string> {
  return text.match(/\s*[\p{L}\p{N}_'’-]+|\s*[^\s\p{L}\p{N}]+/gu) ?? [];
}

function example(entry: Entry, sentence: string, index: number): TokenExample {
  const words = tokenize(sentence);

  const shares = words.map(
    (text, position) => entry.hot[text.trim().toLowerCase()] ?? 0.04 * Math.abs(Math.sin(position * 2.1 + index)),
  );

  const strongest = Math.max(...shares);

  const tokens = words.map((text, position) => ({
    text,
    value: round(((shares[position] ?? 0) / strongest) * entry.max * (1 - index * 0.09), 2),
  }));

  const peak = Math.max(...tokens.map((token) => token.value));

  return {
    id: `${entry.id}-${index}`,
    label: `Document ${1200 + index * 37 + entry.layer} · token ${tokens.findIndex((token) => token.value === peak)}`,
    tokens,
    peakIndex: tokens.findIndex((token) => token.value === peak),
  };
}

function cardOf(entry: Entry): FeatureCardData {
  const width = entry.max / DENSITY_BINS;

  return {
    feature: {
      id: entry.id,
      label: entry.label,
      source: `Layer ${entry.layer} · 65k dictionary`,
      explanation: entry.explanation,
      frequency: entry.frequency,
    },
    density: {
      bins: Array.from({ length: DENSITY_BINS }, (_, bin) => ({
        id: `bin-${bin}`,
        label: `${(bin * width).toFixed(1)}–${((bin + 1) * width).toFixed(1)}`,
        lowerBound: round(bin * width),
        upperBound: round((bin + 1) * width),
        count: Math.round(42_000 * Math.exp(-bin / 2.6) + 600 * Math.exp(-((bin - 11) ** 2) / 6)),
      })),
      value: { label: 'Activation', domain: [0, round(entry.max)], format: activationFormat },
      count: { label: 'Tokens', format: { notation: 'compact' } },
    },
    examples: {
      examples: entry.sentences.map((sentence, index) => example(entry, sentence, index)),
      domain: [0, Math.ceil(entry.max)],
      valueFormat: activationFormat,
    },
    logits: {
      tokens: [
        ...entry.promotes.map((token, index) => ({ id: `up-${index}`, token, value: round(1.3 - index * 0.17, 2) })),
        ...entry.suppresses.map((token, index) => ({
          id: `down-${index}`,
          token,
          value: round(-0.95 + index * 0.14, 2),
        })),
      ],
      value: { label: 'Direct logit effect', format: logitFormat },
    },
  };
}

const details: Readonly<Record<string, FeatureCardData>> = Object.fromEntries(
  catalog.map((entry) => [entry.id, cardOf(entry)]),
);

function cardFor(id: string): FeatureCardData {
  return details[id] ?? { feature: { id, label: id } };
}

const listRows: ReadonlyArray<FeatureListRow> = catalog.map((entry) => ({
  ...cardFor(entry.id).feature,
  maxActivation: entry.max,
  profile: Array.from({ length: LAYER_COUNT }, (_, layer) =>
    round(entry.max * Math.exp(-((layer * 2 - entry.layer) ** 2) / 18), 2),
  ),
}));

const listShared = {
  title: 'Layer features',
  locale: LOCALE,
  features: listRows,
  frequencyDomain: [0, 0.035],
  frequencyFormat: shareFormat,
  activationFormat,
  profileDomain: [0, 12],
} as const;

export const Card: Story = {
  render: () => (
    <div {...stylex.props(styles.page)}>
      <FeatureCard {...cardFor('f-ggb')} locale={LOCALE} />
      <div {...stylex.props(styles.cards)}>
        {['f-neg', 'f-pydef', 'f-sf'].map((id) => (
          <FeatureCard key={id} {...cardFor(id)} locale={LOCALE} size="compact" />
        ))}
      </div>
    </div>
  ),
};

function ListStory(): ReactNode {
  const [selected, setSelected] = useState<string | null>('f-ggb');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<DataTableSort | undefined>({ columnId: 'frequency', direction: 'descending' });

  return (
    <FeatureList
      {...listShared}
      selected={selected}
      onSelectedChange={(id) => setSelected(id)}
      query={query}
      onQueryChange={(next) => setQuery(next)}
      sort={sort}
      onSortChange={setSort}
    />
  );
}

export const List: Story = { render: () => <ListStory /> };

const graphLayers: ReadonlyArray<AttributionLayer> = [
  { id: 'emb', label: 'Embeddings' },
  { id: 'l4', label: 'Layer 4' },
  { id: 'l10', label: 'Layer 10' },
  { id: 'l16', label: 'Layer 16' },
  { id: 'l22', label: 'Layer 22' },
  { id: 'out', label: 'Logits' },
];

const graphNodes: ReadonlyArray<AttributionNode> = [
  ...[' Golden', ' Gate', ' Bridge', ' is', ' in', ' San'].map((label, index) => ({
    id: `tok-${index}`,
    layerId: 'emb',
    label,
    kind: 'token' as const,
  })),
  ...(
    [
      ['f-bridges', 'l4', 'bridge', 0.62],
      ['f-gate-word', 'l4', 'gate', 0.71],
      ['f-ggb', 'l10', 'GG Bridge', 0.93],
      ['f-place', 'l10', 'is in', 0.58],
      ['f-sf', 'l16', 'SF', 0.84],
      ['f-ca', 'l16', 'Calif.', 0.41],
      ['f-say-francisco', 'l22', 'say Fran.', 0.88],
    ] as const
  ).map(([id, layerId, label, value]) => ({ id, layerId, label, detail: cardFor(id).feature.label, value })),
  ...['l4', 'l10', 'l22'].map((layerId) => ({
    id: `err-${layerId}`,
    layerId,
    label: 'Error',
    kind: 'error' as const,
    value: null,
  })),
  ...[' Francisco', ' Jose', ' Diego'].map((label, index) => ({
    id: `out-${index}`,
    layerId: 'out',
    label,
    kind: 'output' as const,
  })),
];

const graphEdges: ReadonlyArray<AttributionEdge> = (
  [
    ['tok-0', 'f-ggb', 0.31],
    ['tok-1', 'f-gate-word', 0.74],
    ['tok-2', 'f-bridges', 0.69],
    ['tok-3', 'f-place', 0.22],
    ['tok-4', 'f-place', 0.47],
    ['tok-5', 'f-sf', 0.36],
    ['tok-5', 'f-say-francisco', 0.18],
    ['f-gate-word', 'f-ggb', 0.52],
    ['f-bridges', 'f-ggb', 0.44],
    ['err-l4', 'err-l10', 0.06],
    ['f-ggb', 'f-sf', 0.58],
    ['f-ggb', 'f-ca', 0.27],
    ['f-place', 'f-sf', 0.21],
    ['f-place', 'f-ca', 0.15],
    ['err-l10', 'f-sf', 0.05],
    ['f-sf', 'f-say-francisco', 0.63],
    ['f-ca', 'f-say-francisco', 0.19],
    ['f-ggb', 'err-l22', 0.07],
    ['f-say-francisco', 'out-0', 0.82],
    ['f-say-francisco', 'out-1', -0.34],
    ['f-say-francisco', 'out-2', -0.29],
    ['f-sf', 'out-0', 0.24],
    ['f-ca', 'out-2', 0.12],
    ['err-l22', 'out-0', 0.04],
  ] as const
).map(([sourceId, targetId, weight]) => ({ id: `${sourceId}>${targetId}`, sourceId, targetId, weight }));

const graphIds = new Set(graphNodes.map((node) => node.id));
const graphDetails = Object.fromEntries(Object.entries(details).filter(([id]) => graphIds.has(id)));

const workbenchShared = {
  title: 'How the model completes "The Golden Gate Bridge is in San"',
  description: 'Synthetic attribution graph for the next token " Francisco", pruned to the strongest paths.',
  locale: LOCALE,
  layers: graphLayers,
  nodes: graphNodes,
  edges: graphEdges,
  details: graphDetails,
  weightLabel: 'Attribution',
  weightFormat: { maximumFractionDigits: 2 },
  valueLabel: 'Activation',
  valueFormat: { maximumFractionDigits: 2 },
} as const;

function WorkbenchStory(): ReactNode {
  const [selected, setSelected] = useState<string | null>('f-ggb');
  const [pinned, setPinned] = useState<ReadonlyArray<string>>(['f-ggb', 'f-sf', 'f-say-francisco']);

  return (
    <AttributionWorkbench
      {...workbenchShared}
      selected={selected}
      onSelectedChange={(id) => setSelected(id)}
      pinned={pinned}
      onPinnedChange={(ids) => setPinned(ids)}
    />
  );
}

export const Workbench: Story = { render: () => <WorkbenchStory /> };

const attentionTokens: ReadonlyArray<AttentionToken> = ['When', ' Mary', ' met', ' John', ',', ' John', ' thanked'].map(
  (text, index) => ({ id: `p${index}`, index, text }),
);

/** How strongly each head scores a pair before the softmax, by destination (the token that attends) and source. */
const headScores: ReadonlyArray<{
  readonly id: string;
  readonly label: string;
  readonly description: string;
  readonly score: (source: number, destination: number) => number;
}> = [
  {
    id: 'l1h3',
    label: 'Layer 1 · head 3',
    description: 'Previous-token head: each token reads the one before it.',
    score: (from, to) => (to === from - 1 ? 4 : 0.2 * Math.cos(from + to)),
  },
  {
    id: 'l2h0',
    label: 'Layer 2 · head 0',
    description: 'Attends to the first token when it has nothing better to do.',
    score: (_, to) => (to === 0 ? 3 : 0.3 * Math.sin(to)),
  },
  {
    id: 'l3h1',
    label: 'Layer 3 · head 1',
    description: 'Duplicate-token head: the second John reads the first.',
    score: (from, to) =>
      attentionTokens[from]?.text === attentionTokens[to]?.text && from !== to ? 4.5 : to === from ? 1 : 0,
  },
  {
    id: 'l5h5',
    label: 'Layer 5 · head 5',
    description: 'Induction head: reads the token after an earlier copy of the current one.',
    score: (from, to) => (from === 5 && to === 4 ? 4 : to === from ? 1.2 : 0.1 * to),
  },
  {
    id: 'l7h9',
    label: 'Layer 7 · head 9',
    description: 'Local head: weight falls off with distance.',
    score: (from, to) => -0.9 * (from - to),
  },
  {
    id: 'l9h6',
    label: 'Layer 9 · head 6',
    description: 'Name mover: "thanked" reads the name that has not been repeated.',
    score: (from, to) => (from === 6 && to === 1 ? 5 : from === 6 && to === 5 ? 1.5 : to === from ? 1 : 0),
  },
];

const heads: ReadonlyArray<AttentionHead> = headScores.map(({ id, label, description, score }) => ({
  id,
  label,
  description,
  weights: attentionTokens.map((_, source) => {
    const raw = attentionTokens.map((__, destination) =>
      destination <= source ? Math.exp(score(source, destination)) : 0,
    );

    const total = sum(raw);

    return raw.map((value, destination) => (destination <= source ? round(value / total) : null));
  }),
}));

function HeadsStory(): ReactNode {
  const [selected, setSelected] = useState<string | null>('l9h6');

  return (
    <AttentionHeadGrid
      title="Heads on an indirect-object prompt"
      description="Synthetic attention patterns over “When Mary met John, John thanked”. Every panel shares the 0 to 1 scale; press a cell to mark that pair in every head."
      locale={LOCALE}
      tokens={attentionTokens}
      heads={heads}
      mask="causal"
      selected={selected}
      onSelectedChange={(id) => setSelected(id)}
    />
  );
}

export const AttentionHeads: Story = { render: () => <HeadsStory /> };

const lensLayers: ReadonlyArray<LensLayer> = Array.from({ length: LAYER_COUNT }, (_, index) => ({
  id: `L${index * 2}`,
  label: `Layer ${index * 2}`,
  depth: index * 2,
}));

const lensPositions = [
  { token: 'The', early: ' same', late: ' first', at: 12, final: 0.18 },
  { token: ' Eiffel', early: ' Eiffel', late: ' Tower', at: 5, final: 0.96 },
  { token: ' Tower', early: ' tower', late: ' is', at: 10, final: 0.41 },
  { token: ' is', early: ' a', late: ' located', at: 13, final: 0.34 },
  { token: ' in', early: ' the', late: ' Paris', at: 15, final: 0.63 },
  { token: ' the', early: ' same', late: ' heart', at: 14, final: 0.29 },
  { token: ' city', early: ' of', late: ' of', at: 4, final: 0.88 },
  { token: ' of', early: ' the', late: ' Paris', at: 13, final: 0.91 },
] as const;

function rise(depth: number, at: number): number {
  return 1 / (1 + Math.exp(-(depth - at) / 1.8));
}

const lensColumns = lensPositions.map((position, index) => ({ id: `pos-${index}`, token: position.token }));

const lensCells: ReadonlyArray<TokenGridCell> = lensPositions.flatMap((position, index) =>
  lensLayers.map((layer) => {
    const late = rise(layer.depth, position.at) * position.final;
    const early = 0.32 * (1 - rise(layer.depth, position.at)) + 0.02;

    return {
      rowId: layer.id,
      columnId: `pos-${index}`,
      token: late >= early ? position.late : position.early,
      value: round(Math.max(late, early)),
    };
  }),
);

const lensTracks: ReadonlyArray<LensTrack> = [
  { id: 'of-paris', columnId: 'pos-7', token: ' Paris', at: 13, final: 0.91 },
  { id: 'of-london', columnId: 'pos-7', token: ' London', at: 9, final: 0.03 },
  { id: 'of-the', columnId: 'pos-7', token: ' the', at: -40, final: 0 },
  { id: 'in-paris', columnId: 'pos-4', token: ' Paris', at: 15, final: 0.63 },
  { id: 'in-france', columnId: 'pos-4', token: ' France', at: 14, final: 0.21 },
].map(({ at, final, ...track }) => ({
  ...track,
  probabilities: lensLayers.map((layer) =>
    round(at < 0 ? 0.32 * (1 - rise(layer.depth, 13)) + 0.02 : rise(layer.depth, at) * final + 0.01),
  ),
}));

const lensShared = {
  title: 'Logit lens on "The Eiffel Tower is in the city of"',
  description: 'Synthetic. Each cell is the top next-token guess read off the residual stream at that layer.',
  locale: LOCALE,
  columns: lensColumns,
  layers: lensLayers,
  cells: lensCells,
  tracks: lensTracks,
} as const;

function LensStory(): ReactNode {
  const [selected, setSelected] = useState<string | null>(tokenGridCellId('L22', 'pos-7'));

  return <LogitLens {...lensShared} selected={selected} onSelectedChange={(id) => setSelected(id)} />;
}

export const Lens: Story = { render: () => <LensStory /> };

const ATLAS_POINTS = 2400;

const clusters = [
  { id: 'geography', label: 'Places and landmarks', x: -4, y: 2.5 },
  { id: 'code', label: 'Source code', x: 3.5, y: 3 },
  { id: 'syntax', label: 'Grammar and syntax', x: 0.5, y: -1 },
  { id: 'science', label: 'Science and sequences', x: 4.5, y: -3.5 },
  { id: 'language', label: 'Other languages', x: -3, y: -3.5 },
  { id: 'formal', label: 'Dates and legal text', x: 0, y: 5 },
] as const;

/** A deterministic scatter in [-1, 1] from an index, so the map draws the same on every load. */
function jitter(index: number, salt: number): number {
  const value = Math.sin(index * 12.9898 + salt * 78.233) * 43_758.5453;

  return 2 * (value - Math.floor(value)) - 1;
}

const atlasGroups = Array.from({ length: ATLAS_POINTS }, (_, index) => index % clusters.length);

const atlasSpread = atlasGroups.map((cluster, index) => ({
  cluster,
  radius: 1.6 * Math.abs(jitter(index, 3)),
  turn: jitter(index, 7) * Math.PI,
}));

const atlasPoints = {
  group: atlasGroups,
  x: atlasSpread.map((point) => round((clusters[point.cluster]?.x ?? 0) + point.radius * Math.cos(point.turn), 2)),
  y: atlasSpread.map((point) => round((clusters[point.cluster]?.y ?? 0) + point.radius * Math.sin(point.turn), 2)),
};

const atlasLandmarks = catalog.map((entry, index) => ({
  id: entry.id,
  x: round((clusters[entry.cluster]?.x ?? 0) + 1.1 * jitter(index, 11), 2),
  y: round((clusters[entry.cluster]?.y ?? 0) + 1.1 * jitter(index, 13), 2),
}));

const atlasShared = {
  title: 'Feature map, layer 10 to 22',
  description: 'Synthetic two-dimensional projection of 2,400 decoder directions, colored by topic cluster.',
  locale: LOCALE,
  points: atlasPoints,
  groups: clusters.map(({ id, label }) => ({ id, label })),
  x: { label: 'Projection 1', format: { maximumFractionDigits: 1 } },
  y: { label: 'Projection 2', format: { maximumFractionDigits: 1 } },
  landmarks: atlasLandmarks,
  details,
} as const;

function AtlasStory(): ReactNode {
  const [query, setQuery] = useState('bridge');
  const [selected, setSelected] = useState<string | null>('f-ggb');

  return (
    <EmbeddingAtlas
      {...atlasShared}
      query={query}
      onQueryChange={(next) => setQuery(next)}
      selected={selected}
      onSelectedChange={(id) => setSelected(id)}
    />
  );
}

export const Atlas: Story = { render: () => <AtlasStory /> };

const steeringTokens = [
  { id: 'the', token: ' the', logit: 2.1, bridge: -0.25, negation: 0.05 },
  { id: 'paris', token: ' Paris', logit: 1.2, bridge: -0.12, negation: -0.02 },
  { id: 'japan', token: ' Japan', logit: 1, bridge: -0.1, negation: 0 },
  { id: 'golden', token: ' Golden', logit: -1.5, bridge: 0.55, negation: 0 },
  { id: 'san', token: ' San', logit: -0.4, bridge: 0.32, negation: 0 },
  { id: 'not', token: ' not', logit: -0.8, bridge: 0, negation: 0.5 },
] as const;

function predictionsAt(values: Readonly<Record<string, number>>) {
  const bridge = values['f-ggb'] ?? 0;
  const negation = values['f-neg'] ?? 0;

  function softmax(logits: ReadonlyArray<number>): ReadonlyArray<number> {
    const total = sum(logits.map(Math.exp)) + Math.exp(2.4);

    return logits.map((logit) => Math.exp(logit) / total);
  }

  const before = softmax(steeringTokens.map((token) => token.logit));
  const after = softmax(steeringTokens.map((token) => token.logit + bridge * token.bridge + negation * token.negation));

  return steeringTokens
    .map((token, index) => ({
      id: token.id,
      token: token.token,
      probability: round(after[index] ?? 0),
      baseline: round(before[index] ?? 0),
    }))
    .toSorted((first, second) => second.probability - first.probability);
}

function completionAt(values: Readonly<Record<string, number>>): string {
  const bridge = values['f-ggb'] ?? 0;

  if (bridge >= 6) {
    return 'the Golden Gate Bridge. I cross it at sunrise and the fog sits on the towers like a second bridge.';
  }

  return bridge >= 3
    ? 'San Francisco, mostly for the bay and the walk out to the bridge.'
    : 'Paris in the spring, when the cafés put their tables back on the pavement.';
}

const steeringFeatures = [
  {
    id: 'f-ggb',
    label: 'Golden Gate Bridge',
    description: 'Pulls the text toward the bridge and the bay.',
    min: -10,
    max: 10,
    step: 0.5,
  },
  {
    id: 'f-neg',
    label: 'Negation',
    description: 'Makes the next clause more likely to deny something.',
    min: -10,
    max: 10,
    step: 0.5,
  },
] as const;

function SteeringStory(): ReactNode {
  const [values, setValues] = useState<Readonly<Record<string, number>>>({ 'f-ggb': 6.5 });

  return (
    <SteeringPanel
      title="Steering the next token"
      locale={LOCALE}
      source="Synthetic outputs computed in the story from closed-form logits."
      features={steeringFeatures}
      values={values}
      onValuesChange={(next) => setValues(next)}
      prompt="My favourite place to visit is"
      predictions={predictionsAt(values)}
      completions={{ baseline: completionAt({}), steered: completionAt(values) }}
    />
  );
}

export const Steering: Story = { render: () => <SteeringStory /> };

function InvestigationPage(): ReactNode {
  const [opened, setOpened] = useState<string | null>('f-ggb');
  const [query, setQuery] = useState('');
  const [pinned, setPinned] = useState<ReadonlyArray<string>>(['f-ggb', 'f-say-francisco']);
  const [sort, setSort] = useState<DataTableSort | undefined>();

  return (
    <ChartLink>
      <div {...stylex.props(styles.page)}>
        <div {...stylex.props(styles.intro)}>
          <h2 {...stylex.props(styles.heading)}>Why does the model say “Francisco”?</h2>
          <p {...stylex.props(styles.lede)}>
            Synthetic investigation. Find a feature in the dictionary, read its card, then trace where it sits in the
            circuit. Resting on a row lights the same feature in the graph.
          </p>
        </div>
        <FeatureList
          {...listShared}
          selected={opened}
          onSelectedChange={(id) => setOpened(id)}
          query={query}
          onQueryChange={(next) => setQuery(next)}
          sort={sort}
          onSortChange={setSort}
        />
        {opened !== null && <FeatureCard {...cardFor(opened)} locale={LOCALE} />}
        <AttributionWorkbench
          {...workbenchShared}
          selected={graphIds.has(opened ?? '') ? opened : null}
          onSelectedChange={(id) => setOpened(id)}
          pinned={pinned}
          onPinnedChange={(ids) => setPinned(ids)}
        />
      </div>
    </ChartLink>
  );
}

export const Investigation: Story = { render: () => <InvestigationPage /> };

export const States: Story = {
  render: () => (
    <div {...stylex.props(styles.states)}>
      <FeatureCard {...cardFor('f-neg')} locale={LOCALE} status="loading" size="compact" />
      <FeatureCard feature={{ id: 'f-31877', label: 'Unlabelled feature 31877', source: 'Layer 20' }} locale={LOCALE} />
      <FeatureList {...listShared} title="Loading features" status="loading" />
      <FeatureList {...listShared} title="No features yet" features={[]} />
      <LogitLens
        {...lensShared}
        title="Partial logit lens"
        cells={lensCells.filter((cell) => cell.columnId !== 'pos-2')}
        coverage={{ shown: 88, total: 96, unit: 'cells' }}
      />
      <AttentionHeadGrid
        title="Heads with a repeated id"
        locale={LOCALE}
        tokens={attentionTokens}
        heads={[...heads.slice(0, 2), heads[0] ?? { id: 'x', label: 'x', weights: [] }]}
      />
      <AttributionWorkbench {...workbenchShared} title="Workbench with a stray card" details={details} />
    </div>
  ),
};
