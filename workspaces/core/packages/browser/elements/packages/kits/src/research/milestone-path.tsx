import type { ReactNode } from 'react';
import { TreeDiagram } from '../../../charts/src/graph/index.ts';
import type { TreeNode } from '../../../charts/src/graph/index.ts';
import { formatValue } from '../../../charts/src/index.ts';
import type { ChartTone, FigureProps, FigureSelectionProps, ValueFormat } from '../../../charts/src/index.ts';
import { Details } from '../../../collections/src/index.ts';
import { Badge, Panel, Row, Stack, Text } from '../../../core/src/index.ts';
import { EmptyState, Notice } from '../../../feedback/src/index.ts';

export type MilestoneKind = 'baseline' | 'result' | 'breakthrough' | 'counterexample' | 'decision';

export type ResearchMilestone = {
  readonly id: string;
  readonly parentId: string | null;
  readonly label: string;
  readonly kind: MilestoneKind;
  readonly claim: string;
  readonly limitation?: string | undefined;
  readonly metric?: number | null | undefined;
  readonly delta?: number | null | undefined;
  readonly source?: string | undefined;
  readonly wave?: string | undefined;
};

export type MilestonePathLabels = {
  readonly metric: string;
  readonly delta: string;
  readonly limitation: string;
  readonly source: string;
  readonly selectHint: string;
  readonly empty: string;
  readonly kinds: Readonly<Record<MilestoneKind, string>>;
};

export type MilestonePathProps = Pick<
  FigureProps,
  'title' | 'description' | 'locale' | 'status' | 'source' | 'transforms'
> &
  FigureSelectionProps & {
    readonly milestones: ReadonlyArray<ResearchMilestone>;
    readonly valueLabel: string;
    readonly valueFormat: ValueFormat;
    readonly deltaFormat?: ValueFormat | undefined;
    readonly labels?: Partial<MilestonePathLabels> | undefined;
  };

const kindTones: Readonly<Record<MilestoneKind, ChartTone>> = {
  baseline: 'series5',
  result: 'series1',
  breakthrough: 'positive',
  counterexample: 'negative',
  decision: 'series3',
};

const kindBadgeTone: Readonly<Record<MilestoneKind, 'neutral' | 'positive' | 'warning' | 'negative'>> = {
  baseline: 'neutral',
  result: 'neutral',
  breakthrough: 'positive',
  counterexample: 'negative',
  decision: 'warning',
};

const defaultLabels: MilestonePathLabels = {
  metric: 'Measured score',
  delta: 'Change',
  limitation: 'Limitation',
  source: 'Evidence',
  selectHint: 'Select any milestone node to inspect its claim, delta, and limitation.',
  empty: 'No research milestones recorded yet.',
  kinds: {
    baseline: 'Baseline',
    result: 'Result',
    breakthrough: 'Breakthrough',
    counterexample: 'Falsified',
    decision: 'Decision',
  },
};

/**
 * A branching progression of research milestones: baselines, breakthroughs, falsified counterexamples, and decisions
 * composed from `TreeDiagram` with a linked evidence inspection panel. Draws no SVG of its own.
 */
export function MilestonePath({
  milestones,
  valueLabel,
  valueFormat,
  deltaFormat,
  selected,
  onSelectedChange,
  labels: given,
  ...figure
}: MilestonePathProps): ReactNode {
  const labels: MilestonePathLabels = {
    ...defaultLabels,
    ...given,
    kinds: { ...defaultLabels.kinds, ...given?.kinds },
  };

  if (milestones.length === 0) {
    return <EmptyState title={figure.title}>{labels.empty}</EmptyState>;
  }

  const ids = new Set(milestones.map((item) => item.id));

  if (ids.size !== milestones.length) {
    return <Notice hasError>Milestones must have unique identifiers.</Notice>;
  }

  const roots = milestones.filter((item) => item.parentId === null);

  if (roots.length !== 1) {
    return <Notice hasError>MilestonePath requires exactly one root milestone (parentId: null).</Notice>;
  }

  const nodes: ReadonlyArray<TreeNode> = milestones.map((item) => ({
    id: item.id,
    parentId: item.parentId,
    label: item.label,
    detail: item.wave === undefined ? labels.kinds[item.kind] : `${item.wave} · ${labels.kinds[item.kind]}`,
    value: item.metric ?? null,
    tone: kindTones[item.kind],
  }));

  const presentKinds = Array.from(new Set(milestones.map((item) => item.kind)));
  const toneLegend = presentKinds.map((kind) => ({ id: kind, label: labels.kinds[kind], tone: kindTones[kind] }));

  const active = milestones.find((item) => item.id === selected) ?? null;

  return (
    <Stack isCompact>
      <TreeDiagram
        {...figure}
        nodes={nodes}
        direction="right"
        link="elbow"
        valueLabel={valueLabel}
        valueFormat={valueFormat}
        toneLegend={toneLegend}
        selected={selected}
        onSelectedChange={onSelectedChange}
      />
      {active === null ? (
        <Text variant="caption" tone="muted">
          {labels.selectHint}
        </Text>
      ) : (
        <Panel
          title={active.label}
          index={active.wave}
          meta={
            <Row>
              <Badge tone={kindBadgeTone[active.kind]}>{labels.kinds[active.kind]}</Badge>
            </Row>
          }
        >
          <Stack isCompact>
            <Text>{active.claim}</Text>
            <Details
              items={[
                ...(active.metric === undefined
                  ? []
                  : [
                      {
                        label: labels.metric,
                        value: formatValue({ value: active.metric, locale: figure.locale, format: valueFormat }),
                      },
                    ]),
                ...(active.delta === undefined
                  ? []
                  : [
                      {
                        label: labels.delta,
                        value: formatValue({
                          value: active.delta,
                          locale: figure.locale,
                          format: deltaFormat ?? valueFormat,
                        }),
                      },
                    ]),
                ...(active.limitation === undefined ? [] : [{ label: labels.limitation, value: active.limitation }]),
                ...(active.source === undefined ? [] : [{ label: labels.source, value: active.source }]),
              ]}
            />
          </Stack>
        </Panel>
      )}
    </Stack>
  );
}
