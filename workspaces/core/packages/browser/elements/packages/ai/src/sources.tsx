import * as stylex from '@stylexjs/stylex';
import type { ReactNode } from 'react';
import { ContentLink } from '../../content/src/link.ts';
import { Stack, TextButton } from '../../core/src/index.ts';
import { colors, spacing, typography } from '../../foundations/src/tokens.stylex.ts';
import { Popover } from '../../overlays/src/index.ts';

const styles = stylex.create({
  root: {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.sm,
    minWidth: 0,
    fontFamily: typography.fontFamily,
    fontSize: typography.bodySize,
    lineHeight: typography.bodyLineHeight,
    fontWeight: typography.regularWeight,
    color: colors.ink,
  },
  heading: {
    margin: 0,
    fontSize: typography.bodySize,
    lineHeight: typography.bodyLineHeight,
    fontWeight: typography.mediumWeight,
    overflowWrap: 'anywhere',
  },
  list: { display: 'flex', flexDirection: 'column', gap: spacing.md, margin: 0, padding: 0, listStyleType: 'none' },
  item: { display: 'flex', flexDirection: 'column', gap: spacing.xxs, minWidth: 0, overflowWrap: 'anywhere' },
  description: {
    margin: 0,
    color: colors.muted,
    fontSize: typography.captionSize,
    lineHeight: typography.captionLineHeight,
    overflowWrap: 'anywhere',
  },
  citation: { display: 'inline', verticalAlign: 'baseline', fontVariantNumeric: 'tabular-nums' },
});

export type Source = {
  readonly id: string;
  readonly title: string;
  readonly href: string;
  readonly description?: string;
};

export type SourcesProps = { readonly sources: ReadonlyArray<Source>; readonly label?: string };
export type InlineCitationProps = { readonly source: Source; readonly label: string };

export function Sources({ sources, label = 'Sources' }: SourcesProps): ReactNode {
  return (
    <section aria-label={label} {...stylex.props(styles.root)}>
      <h3 {...stylex.props(styles.heading)}>{label}</h3>
      {sources.length === 0 && <p {...stylex.props(styles.description)}>No sources supplied.</p>}
      <ol {...stylex.props(styles.list)}>
        {sources.map((source) => (
          <li key={source.id} {...stylex.props(styles.item)}>
            <span>
              <ContentLink href={source.href}>{source.title}</ContentLink>
            </span>
            {source.description !== undefined && <p {...stylex.props(styles.description)}>{source.description}</p>}
          </li>
        ))}
      </ol>
    </section>
  );
}

export function InlineCitation({ source, label }: InlineCitationProps): ReactNode {
  return (
    <span {...stylex.props(styles.citation)}>
      <Popover.Root>
        <Popover.Trigger render={<TextButton />} aria-label={`Source ${label}: ${source.title}`}>
          {label}
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Positioner side="top">
            <Popover.Popup>
              <Stack isCompact>
                <Popover.Title>{source.title}</Popover.Title>
                {source.description !== undefined && <Popover.Description>{source.description}</Popover.Description>}
                <ContentLink href={source.href}>Open source</ContentLink>
              </Stack>
            </Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>
    </span>
  );
}
