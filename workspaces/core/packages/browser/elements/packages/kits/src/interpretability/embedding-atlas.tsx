import * as stylex from '@stylexjs/stylex';
import { useId } from 'react';
import type { ReactNode } from 'react';
import { EmbeddingMap } from '../../../charts/src/relationship/index.ts';
import type { EmbeddingMapProps } from '../../../charts/src/relationship/index.ts';
import { Button } from '../../../core/src/index.ts';
import { Notice } from '../../../feedback/src/index.ts';
import { Field, Input } from '../../../forms/src/index.ts';
import { FeatureCard } from './feature-card.tsx';
import type { FeatureCardLabels } from './feature-card.tsx';
import { featureLimits, matchesQuery, useFeatureHighlight } from './features.ts';
import type { FeatureCardData, InterpretabilityChangeDetails } from './features.ts';
import { kitStyles } from './kit-styles.ts';
import { SharedLink } from './shared-link.tsx';

/** The words beside the map. Each has an English default. */
export type EmbeddingAtlasLabels = {
  readonly search: string;
  readonly searchDescription: string;
  readonly matches: string;
  readonly noMatches: string;
  readonly more: string;
  readonly hint: string;
  readonly card: Partial<FeatureCardLabels>;
};

export type EmbeddingAtlasProps = Omit<EmbeddingMapProps, 'selected' | 'onSelectedChange' | 'landmarks'> & {
  /**
   * The features a reader can find, each placed on the map as a labelled landmark. Its card data comes from `details`
   * under the same id.
   */
  readonly landmarks: ReadonlyArray<{ readonly id: string; readonly x: number; readonly y: number }>;
  /** Each findable feature's card: its name, explanation and any charts. Keyed by landmark id. */
  readonly details: Readonly<Record<string, FeatureCardData>>;
  /** The search text. Only matching landmarks stay labelled on the map. */
  readonly query?: string | undefined;
  readonly onQueryChange?: ((query: string, details: InterpretabilityChangeDetails) => void) | undefined;
  /** The feature whose card is open beside the map. */
  readonly selected?: string | null | undefined;
  readonly onSelectedChange?: ((id: string, details: InterpretabilityChangeDetails) => void) | undefined;
  readonly labels?: Partial<EmbeddingAtlasLabels> | undefined;
};

const defaultLabels: EmbeddingAtlasLabels = {
  search: 'Find a feature',
  searchDescription: 'Searches feature names, ids and explanations.',
  matches: 'Matches',
  noMatches: 'No feature matches the search.',
  more: 'more match. Refine the search to see them.',
  hint: 'Select a labelled feature on the map, or search for one.',
  card: {},
};

function MatchList({
  ids,
  details,
  selected,
  onSelectedChange,
}: {
  readonly ids: ReadonlyArray<string>;
  readonly details: EmbeddingAtlasProps['details'];
  readonly selected: string | null;
  readonly onSelectedChange: EmbeddingAtlasProps['onSelectedChange'];
}): ReactNode {
  const highlight = useFeatureHighlight(ids);

  return (
    <ul {...stylex.props(kitStyles.list)} onPointerLeave={() => highlight(undefined)}>
      {ids.map((id) => (
        <li key={id}>
          <Button
            variant={id === selected ? 'solid' : 'ghost'}
            density="compact"
            aria-pressed={id === selected}
            onPointerEnter={() => highlight(id)}
            onFocus={() => highlight(id)}
            onClick={(event) => onSelectedChange?.(id, { reason: 'press', event: event.nativeEvent })}
          >
            {details[id]?.feature.label ?? id}
          </Button>
        </li>
      ))}
    </ul>
  );
}

/**
 * A map of features, such as a projection of decoder directions, with a search over the labelled features beside it.
 * Typing narrows the labels on the map and lists the matches; resting on a match lights its label; pressing one, or its
 * label on the map, opens its card. The application projects the points, holds the search text and the selection, and
 * supplies the cards.
 */
export function EmbeddingAtlas({
  landmarks,
  details,
  query = '',
  onQueryChange,
  selected = null,
  onSelectedChange,
  labels: given,
  ...map
}: EmbeddingAtlasProps): ReactNode {
  const labels = { ...defaultLabels, ...given };
  const searchId = useId();
  const missing = landmarks.find((landmark) => details[landmark.id] === undefined);

  if (missing !== undefined) {
    return <Notice hasError>{`${map.title}: landmark ${missing.id} has no feature details.`}</Notice>;
  }

  const matches = landmarks.filter((landmark) => {
    const card = details[landmark.id];

    return card !== undefined && matchesQuery(card.feature, query);
  });

  const hasQuery = query.trim().length > 0;
  const listed = hasQuery ? matches.slice(0, featureLimits.matches) : [];
  const card = selected === null ? undefined : details[selected];

  return (
    <SharedLink>
      <div {...stylex.props(kitStyles.split)}>
        <div {...stylex.props(kitStyles.main)}>
          <EmbeddingMap
            {...map}
            landmarks={matches.map((landmark) => ({ ...landmark, label: details[landmark.id]?.feature.label ?? '' }))}
            selected={selected}
            onSelectedChange={(id, change) => onSelectedChange?.(id, { reason: 'press', event: change.event })}
          />
        </div>
        <div {...stylex.props(kitStyles.aside)}>
          <Field.Root>
            <Field.Label htmlFor={searchId}>{labels.search}</Field.Label>
            <Input
              id={searchId}
              type="search"
              value={query}
              onValueChange={(value, change) => onQueryChange?.(value, { reason: 'input', event: change.event })}
            />
            <Field.Description>{labels.searchDescription}</Field.Description>
          </Field.Root>
          {hasQuery && (
            <section aria-label={labels.matches} {...stylex.props(kitStyles.tight)}>
              <p {...stylex.props(kitStyles.label)}>{`${labels.matches} (${matches.length})`}</p>
              {matches.length === 0 ? <p {...stylex.props(kitStyles.muted)}>{labels.noMatches}</p> : null}
              <MatchList
                ids={listed.map((landmark) => landmark.id)}
                details={details}
                selected={selected}
                onSelectedChange={onSelectedChange}
              />
              {matches.length > listed.length ? (
                <p {...stylex.props(kitStyles.muted)}>{`${matches.length - listed.length} ${labels.more}`}</p>
              ) : null}
            </section>
          )}
          {card === undefined ? (
            <p {...stylex.props(kitStyles.muted)}>{labels.hint}</p>
          ) : (
            <FeatureCard {...card} locale={map.locale} status={map.status} size="compact" labels={labels.card} />
          )}
        </div>
      </div>
    </SharedLink>
  );
}
