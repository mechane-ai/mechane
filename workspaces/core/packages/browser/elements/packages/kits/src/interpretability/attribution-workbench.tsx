import * as stylex from '@stylexjs/stylex';
import type { ReactNode } from 'react';
import { AttributionGraph } from '../../../charts/src/graph/index.ts';
import type { AttributionGraphProps } from '../../../charts/src/graph/index.ts';
import { ToneScope } from '../../../charts/src/index.ts';
import { Notice } from '../../../feedback/src/index.ts';
import type { FeatureCardData, InterpretabilityChangeDetails } from './features.ts';
import { kitStyles } from './kit-styles.ts';
import { NodePanel } from './node-panel.tsx';
import type { NodePanelLabels } from './node-panel.tsx';
import { SharedLink } from './shared-link.tsx';

export type AttributionWorkbenchLabels = NodePanelLabels;

export type AttributionWorkbenchProps = Omit<
  AttributionGraphProps,
  'selected' | 'onSelectedChange' | 'pinned' | 'onPinnedChange'
> & {
  /**
   * What the panel shows for each feature node, keyed by node id. A node without an entry shows its name only. The
   * application supplies a card for each feature node.
   */
  readonly details: Readonly<Record<string, FeatureCardData>>;
  /** The node the reader opened. It stays in the panel while nothing else is pointed at. */
  readonly selected?: string | null | undefined;
  readonly onSelectedChange?: ((id: string, details: InterpretabilityChangeDetails) => void) | undefined;
  /**
   * The nodes pinned to build a subgraph, in the order they were pinned. The application holds the selection and the
   * pins.
   */
  readonly pinned?: ReadonlyArray<string> | undefined;
  readonly onPinnedChange?: ((ids: ReadonlyArray<string>, details: InterpretabilityChangeDetails) => void) | undefined;
  readonly labels?: Partial<AttributionWorkbenchLabels> | undefined;
};

const defaultLabels: AttributionWorkbenchLabels = {
  hint: 'Point at a node to see its feature here. Press a node to keep it in this panel.',
  pinned: 'Pinned nodes',
  noPins: 'Pin nodes to keep the edges between them in view.',
  pin: 'Pin',
  unpin: 'Unpin',
  noDetails: 'No feature details were supplied for this node.',
  card: {},
};

/**
 * An attribution graph beside a panel for the node in focus, the way circuit-tracing tools present a traced prompt.
 * Point at a node to read its feature card; press it to keep it in the panel; pin nodes to build a subgraph and step
 * between them. The graph and the panel share one chart link, so a feature list or map on the same page lights the same
 * node.
 */
export function AttributionWorkbench({
  details,
  selected = null,
  onSelectedChange,
  pinned = [],
  onPinnedChange,
  labels: given,
  ...graph
}: AttributionWorkbenchProps): ReactNode {
  const labels = { ...defaultLabels, ...given };
  const nodeIds = new Set(graph.nodes.map((node) => node.id));
  const stray = Object.keys(details).find((id) => !nodeIds.has(id));

  if (stray !== undefined) {
    return <Notice hasError>{`${graph.title}: details name node ${stray}, which is not in the graph.`}</Notice>;
  }

  return (
    <ToneScope ids={graph.nodes.map((node) => node.id)}>
      <SharedLink>
        <div {...stylex.props(kitStyles.split)}>
          <div {...stylex.props(kitStyles.main)}>
            <AttributionGraph
              {...graph}
              selected={selected}
              onSelectedChange={(id, change) => onSelectedChange?.(id, { reason: 'press', event: change.event })}
              pinned={pinned}
              onPinnedChange={(ids, change) => onPinnedChange?.(ids, { reason: 'press', event: change.event })}
            />
          </div>
          <NodePanel
            nodes={graph.nodes}
            details={details}
            locale={graph.locale}
            status={graph.status}
            selected={selected}
            pinned={pinned}
            onSelectedChange={(id, change) => onSelectedChange?.(id, change)}
            onPinnedChange={(ids, change) => onPinnedChange?.(ids, change)}
            labels={labels}
          />
        </div>
      </SharedLink>
    </ToneScope>
  );
}
