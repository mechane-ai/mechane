import * as stylex from '@stylexjs/stylex';
import { useCallback } from 'react';
import type { ReactNode } from 'react';
import { Collapsible, CopyValue } from '../../core/src/index.ts';
import { colors, spacing, typography } from '../../foundations/src/tokens.stylex.ts';
import { useScrollTabIndex } from '../../foundations/src/use-scroll-tab-index.ts';
import { viewerStyles } from './viewer-styles.ts';

export type JsonValue =
  | null
  | boolean
  | number
  | string
  | ReadonlyArray<JsonValue>
  | { readonly [key: string]: JsonValue };

export type JsonViewerProps = {
  readonly value: JsonValue;
  readonly label: string;
  readonly maxDepth?: number;
  readonly maxEntries?: number;
};

type JsonEntryProps = Required<Pick<JsonViewerProps, 'maxDepth' | 'maxEntries'>> & {
  readonly value: JsonValue;
  readonly name: string;
  readonly path: string;
  readonly depth: number;
};

const styles = stylex.create({
  body: {
    padding: spacing.md,
    overflow: 'auto',
    maxHeight: 400,
    fontFamily: typography.monoFamily,
    fontSize: typography.captionSize,
  },
  code: { fontFamily: typography.monoFamily, fontSize: typography.captionSize },
  entry: { minWidth: 0, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' },
  children: {
    paddingInlineStart: spacing.lg,
    borderInlineStartWidth: 1,
    borderInlineStartStyle: 'solid',
    borderInlineStartColor: colors.line,
    marginInlineStart: spacing.xs,
  },
  key: { color: colors.muted },
  string: { color: colors.accent },
  value: { color: colors.ink },
  truncated: { color: colors.muted, fontFamily: typography.fontFamily },
});

const STRING_PREVIEW_CHARACTERS = 500;

function JsonEntry({ value, name, path, depth, maxDepth, maxEntries }: JsonEntryProps): ReactNode {
  if (value === null || typeof value !== 'object') {
    const text = JSON.stringify(value);
    const isTruncated = text.length > STRING_PREVIEW_CHARACTERS;

    return (
      <div {...stylex.props(styles.entry)}>
        <span {...stylex.props(styles.key)}>{name}: </span>
        <span {...stylex.props(typeof value === 'string' ? styles.string : styles.value)}>
          {text.slice(0, STRING_PREVIEW_CHARACTERS)}
        </span>
        {isTruncated && <span {...stylex.props(styles.truncated)}>… (value truncated)</span>}
      </div>
    );
  }

  const entries = Object.entries(value);
  const summary = Array.isArray(value) ? `${entries.length} items` : `${entries.length} fields`;

  if (depth >= maxDepth) {
    return (
      <div {...stylex.props(styles.entry)}>
        <span {...stylex.props(styles.key)}>{name}: </span>
        <span {...stylex.props(styles.truncated)}>{summary} · depth limit</span>
      </div>
    );
  }

  return (
    <Collapsible.Root defaultOpen={depth === 0} {...stylex.props(styles.entry)}>
      <Collapsible.Trigger variant="inline">
        <span {...stylex.props(styles.code)}>
          <span {...stylex.props(styles.key)}>{name}: </span>
          {Array.isArray(value) ? '[]' : '{}'} <span {...stylex.props(styles.truncated)}>{summary}</span>
        </span>
      </Collapsible.Trigger>
      <Collapsible.Panel>
        <div {...stylex.props(styles.children, styles.code)}>
          {entries.slice(0, maxEntries).map(([key, entry]) => {
            const entryPath = `${path}/${key.replaceAll('~', '~0').replaceAll('/', '~1')}`;

            return (
              <JsonEntry
                key={entryPath}
                name={JSON.stringify(key)}
                path={entryPath}
                value={entry}
                depth={depth + 1}
                maxDepth={maxDepth}
                maxEntries={maxEntries}
              />
            );
          })}
          {entries.length > maxEntries && (
            <div {...stylex.props(styles.truncated)}>
              {entries.length - maxEntries} more entries · copy to inspect the complete value
            </div>
          )}
        </div>
      </Collapsible.Panel>
    </Collapsible.Root>
  );
}

export function JsonViewer({ value, label, maxDepth = 6, maxEntries = 50 }: JsonViewerProps): ReactNode {
  const scroll = useScrollTabIndex<HTMLDivElement>();
  const copyValue = useCallback(() => JSON.stringify(value, null, 2), [value]);

  return (
    <section aria-label={label} {...stylex.props(viewerStyles.root)}>
      <div {...stylex.props(viewerStyles.header)}>
        <span {...stylex.props(viewerStyles.label)}>{label}</span>
        <CopyValue label={label} value={copyValue}>
          Copy JSON
        </CopyValue>
      </div>
      <div
        ref={scroll.ref}
        role="region"
        aria-label={`${label} fields`}
        tabIndex={scroll.tabIndex}
        {...stylex.props(viewerStyles.scrollRegion, styles.body)}
      >
        <JsonEntry
          name="root"
          path=""
          value={value}
          depth={0}
          maxDepth={Math.max(1, maxDepth)}
          maxEntries={Math.max(1, maxEntries)}
        />
      </div>
    </section>
  );
}
