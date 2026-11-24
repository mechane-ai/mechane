import type { ReactNode } from 'react';
import { formatValue } from '../../../charts/src/index.ts';
import type { ValueFormat } from '../../../charts/src/index.ts';
import { Timestamp } from '../../../collections/src/index.ts';
import { Badge, Collapsible, Identifier, Panel, Row, Stack, Text } from '../../../core/src/index.ts';
import { Preview } from '../../../overlays/src/index.ts';

export type FindingStatus = 'supported' | 'mixed' | 'falsified' | 'open';

export type FindingMetric = {
  readonly label: string;
  readonly value: number | null;
  readonly format: ValueFormat;
  readonly tone?: 'neutral' | 'positive' | 'warning' | 'negative' | undefined;
};

export type FindingSource = {
  readonly id: string;
  readonly label: string;
  readonly href?: string | undefined;
  readonly summary?: string | undefined;
};

export type FindingCardLabels = {
  readonly limitation: string;
  readonly details: string;
  readonly sources: string;
  readonly statusLabels: Readonly<Record<FindingStatus, string>>;
};

export type FindingCardProps = {
  readonly title: string;
  readonly claim: string;
  readonly locale: string;
  readonly status: FindingStatus;
  readonly index?: string | undefined;
  readonly limitation?: string | undefined;
  readonly metrics?: ReadonlyArray<FindingMetric> | undefined;
  readonly sources?: ReadonlyArray<FindingSource> | undefined;
  readonly author?: string | undefined;
  readonly recordedAt?: string | undefined;
  readonly recordedLabel?: string | undefined;
  /** Optional full methodology, notes, or raw markdown disclosed on demand. */
  readonly details?: ReactNode;
  readonly actions?: ReactNode;
  readonly labels?: Partial<FindingCardLabels> | undefined;
};

const defaultLabels: FindingCardLabels = {
  limitation: 'Limitation',
  details: 'Full notes & evidence',
  sources: 'Sources',
  statusLabels: { supported: 'Supported', mixed: 'Mixed', falsified: 'Falsified', open: 'Open' },
};

const statusTone: Readonly<Record<FindingStatus, 'positive' | 'warning' | 'negative' | 'neutral'>> = {
  supported: 'positive',
  mixed: 'warning',
  falsified: 'negative',
  open: 'neutral',
};

/**
 * A framed scientific evidence card: headline claim, explicit limitation, declared metric chips, hover-previewable
 * citations, and optional methodology disclosed on demand. Composes Elements families with zero custom SVG.
 */
export function FindingCard({
  title,
  claim,
  locale,
  status,
  index,
  limitation,
  metrics = [],
  sources = [],
  author,
  recordedAt,
  recordedLabel,
  details,
  actions,
  labels: given,
}: FindingCardProps): ReactNode {
  const labels: FindingCardLabels = {
    ...defaultLabels,
    ...given,
    statusLabels: { ...defaultLabels.statusLabels, ...given?.statusLabels },
  };

  return (
    <Panel
      title={title}
      index={index}
      meta={
        <Row>
          <Badge tone={statusTone[status]}>{labels.statusLabels[status]}</Badge>
          {actions}
        </Row>
      }
      footer={
        author !== undefined || recordedAt !== undefined || sources.length > 0 ? (
          <Row shouldSpaceBetween>
            <Row>
              {author !== undefined && (
                <Text variant="caption" tone="muted">
                  {author}
                </Text>
              )}
              {recordedAt !== undefined && <Timestamp dateTime={recordedAt} label={recordedLabel ?? recordedAt} />}
            </Row>
            {sources.length > 0 && (
              <Row>
                <Text variant="caption" tone="muted">
                  {labels.sources}:
                </Text>
                {sources.map((src) =>
                  src.summary !== undefined && src.href !== undefined ? (
                    <Preview.Root key={src.id}>
                      <Preview.Trigger href={src.href}>
                        <Identifier>{src.label}</Identifier>
                      </Preview.Trigger>
                      <Preview.Popup>
                        <Stack isCompact>
                          <Text>{src.label}</Text>
                          <Text variant="caption" tone="muted">
                            {src.summary}
                          </Text>
                        </Stack>
                      </Preview.Popup>
                    </Preview.Root>
                  ) : (
                    <Identifier key={src.id}>{src.label}</Identifier>
                  ),
                )}
              </Row>
            )}
          </Row>
        ) : undefined
      }
    >
      <Stack isCompact>
        <Text>{claim}</Text>
        {metrics.length > 0 && (
          <Row>
            {metrics.map((metric) => (
              <Badge key={metric.label} tone={metric.tone ?? 'neutral'}>
                {metric.label}: {formatValue({ value: metric.value, locale, format: metric.format })}
              </Badge>
            ))}
          </Row>
        )}
        {limitation !== undefined && (
          <Text variant="caption" tone="muted">
            {labels.limitation}: {limitation}
          </Text>
        )}
        {details !== undefined && (
          <Collapsible.Root>
            <Collapsible.Trigger variant="inline">{labels.details}</Collapsible.Trigger>
            <Collapsible.Panel>{details}</Collapsible.Panel>
          </Collapsible.Root>
        )}
      </Stack>
    </Panel>
  );
}
