import * as stylex from '@stylexjs/stylex';
import { definePrimitive } from '@ui-sdk/core';
import { createParts, mergeProps } from '@ui-sdk/react/primitive';
import { createContext, useContext, useId, useLayoutEffect, useRef } from 'react';
import type { ComponentProps, ReactNode, RefObject } from 'react';
import { Button } from '../../core/src/index.ts';
import { colors, controls, spacing, typography } from '../../foundations/src/tokens.stylex.ts';

const SPLIT_MIN_WIDTH = 860;
const COMPACT_LAYOUT = `@container inspector (max-width:${SPLIT_MIN_WIDTH}px)`;

const styles = stylex.create({
  frame: {
    containerName: 'inspector',
    containerType: 'inline-size',
    minWidth: 0,
    color: colors.ink,
    fontFamily: typography.fontFamily,
    fontSize: typography.bodySize,
    lineHeight: typography.bodyLineHeight,
  },
  split: {
    display: 'grid',
    gridTemplateColumns: { default: 'minmax(0, 1.2fr) minmax(320px, 1fr)', [COMPACT_LAYOUT]: 'minmax(0, 1fr)' },
    alignItems: 'start',
    gap: spacing.xl,
    minWidth: 0,
  },
  master: { minWidth: 0 },
  return: { display: { default: 'none', [COMPACT_LAYOUT]: 'flex' }, marginBlockEnd: spacing.lg },
  detail: {
    'position': { default: 'sticky', [COMPACT_LAYOUT]: 'static' },
    'top': spacing.lg,
    'minWidth': 0,
    'paddingInlineStart': { default: spacing.xl, [COMPACT_LAYOUT]: 0 },
    'paddingBlockStart': { default: 0, [COMPACT_LAYOUT]: spacing.lg },
    'borderInlineStartWidth': { default: 1, [COMPACT_LAYOUT]: 0 },
    'borderInlineStartStyle': 'solid',
    'borderInlineStartColor': colors.line,
    'borderTopWidth': { default: 0, [COMPACT_LAYOUT]: 1 },
    'borderTopStyle': 'solid',
    'borderTopColor': colors.line,
    'scrollMarginBlockStart': spacing.lg,
    ':focus-visible': {
      outlineWidth: controls.focusWidth,
      outlineStyle: 'solid',
      outlineColor: colors.focus,
      outlineOffset: 4,
    },
  },
  list: {
    margin: 0,
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.6fr)',
    columnGap: spacing.xl,
    rowGap: spacing.md,
    fontFamily: typography.fontFamily,
    WebkitFontSmoothing: 'antialiased',
    fontSize: typography.bodySize,
    lineHeight: typography.bodyLineHeight,
  },
  label: { minWidth: 0, color: colors.muted, overflowWrap: 'anywhere' },
  item: { display: 'contents' },
  value: { minWidth: 0, margin: 0, color: colors.ink, overflowWrap: 'anywhere', fontVariantNumeric: 'tabular-nums' },
});

export type InspectorProps = ComponentProps<'div'> & {
  readonly master: ReactNode;
  readonly detail: ReactNode;
  readonly label: string;
  readonly masterLabel: string;
  readonly revealKey?: string | undefined;
  readonly returnFocusRef?: RefObject<HTMLElement | null>;
};

type DetailItem = { readonly label: string; readonly value: ReactNode };
type DetailsProps = ComponentProps<'dl'> & { readonly items: ReadonlyArray<DetailItem> };

const DetailLabel = createContext<string | undefined>(undefined);

function fieldState({ reading }: { reading: string }) {
  return { value: reading };
}

const detailField = definePrimitive({
  name: 'detail-field',
  options: { reading: 'string' },
  state: fieldState,
  sync: fieldState,
  api: () => ({}),
  agent: { actions: [] },
  slots: (slot) => ({ root: slot({}) }),
});

const FieldValue = createParts(detailField, { root: 'dd' }).Root;

export function Inspector({
  master,
  detail,
  label,
  masterLabel,
  revealKey,
  returnFocusRef,
  ...props
}: InspectorProps): ReactNode {
  const detailId = useId();
  const split = useRef<HTMLDivElement>(null);
  const collection = useRef<HTMLDivElement>(null);
  const selected = useRef<HTMLElement>(null);

  useLayoutEffect(() => {
    if (revealKey === undefined || split.current === null || selected.current === null) {
      return;
    }

    if (split.current.clientWidth <= SPLIT_MIN_WIDTH) {
      selected.current.focus({ preventScroll: true });
      selected.current.scrollIntoView({ block: 'start', behavior: 'instant' });
    }
  }, [revealKey]);

  function returnToMaster(): void {
    const target = returnFocusRef?.current ?? collection.current;

    target?.focus({ preventScroll: true });
    target?.scrollIntoView({ block: 'nearest', behavior: 'instant' });
  }

  return (
    <div {...mergeProps(stylex.props(styles.frame), props)}>
      <div ref={split} {...stylex.props(styles.split)}>
        <div
          ref={collection}
          role="group"
          aria-label={masterLabel}
          aria-details={detailId}
          tabIndex={-1}
          {...stylex.props(styles.master)}
        >
          {master}
        </div>
        <aside ref={selected} id={detailId} aria-label={label} tabIndex={-1} {...stylex.props(styles.detail)}>
          <div {...stylex.props(styles.return)}>
            <Button variant="ghost" onClick={returnToMaster}>
              Back to {masterLabel.toLowerCase()}
            </Button>
          </div>
          <DetailLabel.Provider value={label}>{detail}</DetailLabel.Provider>
        </aside>
      </div>
    </div>
  );
}

function DetailValue({ value, label }: DetailItem): ReactNode {
  const reading = typeof value === 'number' ? String(value) : value;

  if (typeof reading === 'string') {
    return (
      <FieldValue aria-label={label} reading={reading} {...stylex.props(styles.value)}>
        {reading}
      </FieldValue>
    );
  }

  return <dd {...stylex.props(styles.value)}>{value}</dd>;
}

export function Details({ items, ...props }: DetailsProps): ReactNode {
  const inspector = useContext(DetailLabel);
  const group = props['aria-label'] ?? inspector;

  return (
    <dl {...mergeProps(stylex.props(styles.list), props)}>
      {items.map(({ label, value }) => (
        <div key={label} {...stylex.props(styles.item)}>
          <dt {...stylex.props(styles.label)}>{label}</dt>
          <DetailValue value={value} label={group === undefined ? label : `${group} · ${label}`} />
        </div>
      ))}
    </dl>
  );
}
