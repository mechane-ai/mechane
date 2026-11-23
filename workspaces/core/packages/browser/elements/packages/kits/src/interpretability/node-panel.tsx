import * as stylex from '@stylexjs/stylex';
import type { ReactNode } from 'react';
import type { AttributionNode } from '../../../charts/src/graph/index.ts';
import { useChartLinkControl } from '../../../charts/src/index.ts';
import type { FigureStatus } from '../../../charts/src/index.ts';
import { Button } from '../../../core/src/index.ts';
import { FeatureCard } from './feature-card.tsx';
import type { FeatureCardLabels } from './feature-card.tsx';
import type { FeatureCardData, InterpretabilityChangeDetails } from './features.ts';
import { kitStyles } from './kit-styles.ts';

/** The words in the workbench's side panel. */
export type NodePanelLabels = {
  readonly hint: string;
  readonly pinned: string;
  readonly noPins: string;
  readonly pin: string;
  readonly unpin: string;
  readonly noDetails: string;
  readonly card: Partial<FeatureCardLabels>;
};

type NodePanelProps = {
  readonly nodes: ReadonlyArray<AttributionNode>;
  readonly details: Readonly<Record<string, FeatureCardData>>;
  readonly locale: string;
  readonly status?: FigureStatus | undefined;
  readonly selected: string | null;
  readonly pinned: ReadonlyArray<string>;
  readonly onSelectedChange: (id: string, details: InterpretabilityChangeDetails) => void;
  readonly onPinnedChange: (ids: ReadonlyArray<string>, details: InterpretabilityChangeDetails) => void;
  readonly labels: NodePanelLabels;
};

/**
 * The node in focus beside an attribution graph: the node the reader points at, else the selected node, else the last
 * pinned one, as a compact feature card. Under it, the pinned nodes as buttons that select them.
 */
export function NodePanel({
  nodes,
  details,
  locale,
  status,
  selected,
  pinned,
  onSelectedChange,
  onPinnedChange,
  labels,
}: NodePanelProps): ReactNode {
  const link = useChartLinkControl();
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const inspected = link?.inspected !== null && byId.has(link?.inspected ?? '') ? link?.inspected : undefined;
  const fallbackId = selected ?? pinned.at(-1) ?? '';
  const focus = byId.get(inspected ?? fallbackId);
  const card = focus === undefined ? undefined : details[focus.id];
  const isPinned = focus !== undefined && pinned.includes(focus.id);

  const pinButton = focus !== undefined && (
    <Button
      variant="outline"
      density="compact"
      aria-pressed={isPinned}
      onClick={(event) =>
        onPinnedChange(isPinned ? pinned.filter((id) => id !== focus.id) : [...pinned, focus.id], {
          reason: 'press',
          event: event.nativeEvent,
        })
      }
    >
      {isPinned ? labels.unpin : labels.pin}
    </Button>
  );

  return (
    <div {...stylex.props(kitStyles.aside)}>
      {focus === undefined && <p {...stylex.props(kitStyles.muted)}>{labels.hint}</p>}
      {card !== undefined && (
        <FeatureCard
          {...card}
          locale={locale}
          status={status}
          size="compact"
          actions={pinButton}
          labels={labels.card}
        />
      )}
      {focus !== undefined && card === undefined && (
        <div {...stylex.props(kitStyles.card)}>
          <div {...stylex.props(kitStyles.heading)}>
            <h3 {...stylex.props(kitStyles.title)}>{focus.label}</h3>
            <p {...stylex.props(kitStyles.meta)}>{[focus.id, focus.detail].filter(Boolean).join(' · ')}</p>
          </div>
          <p {...stylex.props(kitStyles.muted)}>{labels.noDetails}</p>
          <div>{pinButton}</div>
        </div>
      )}
      <section aria-label={labels.pinned} {...stylex.props(kitStyles.tight)}>
        <p {...stylex.props(kitStyles.label)}>{`${labels.pinned} (${pinned.length})`}</p>
        {pinned.length === 0 ? (
          <p {...stylex.props(kitStyles.muted)}>{labels.noPins}</p>
        ) : (
          <ul {...stylex.props(kitStyles.list)}>
            {pinned.map((id) => (
              <li key={id}>
                <Button
                  variant={id === selected ? 'solid' : 'ghost'}
                  density="compact"
                  aria-pressed={id === selected}
                  onClick={(event) => onSelectedChange(id, { reason: 'press', event: event.nativeEvent })}
                >
                  {details[id]?.feature.label ?? byId.get(id)?.label ?? id}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
