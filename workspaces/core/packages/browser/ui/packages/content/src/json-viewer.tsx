import * as stylex from '@stylexjs/stylex';
import { useCallback, useState } from 'react';
import type { ReactNode } from 'react';
import { CopyValue } from '../../core/src/index.ts';
import { colors, controls, spacing, typography } from '../../core/src/tokens.stylex.ts';

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
  root: {
    minWidth: 0,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: colors.line,
    color: colors.ink,
    backgroundColor: colors.surface,
    fontFamily: typography.fontFamily,
    fontSize: typography.bodySize,
    lineHeight: typography.bodyLineHeight,
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    padding: spacing.sm,
    borderBlockEndWidth: 1,
    borderBlockEndStyle: 'solid',
    borderBlockEndColor: colors.line,
  },
  body: {
    padding: spacing.sm,
    overflow: 'auto',
    maxHeight: 400,
    fontFamily: typography.monoFamily,
    fontSize: typography.captionSize,
  },
  entry: { minWidth: 0, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' },
  children: {
    paddingInlineStart: spacing.lg,
    borderInlineStartWidth: 1,
    borderInlineStartStyle: 'solid',
    borderInlineStartColor: colors.line,
    marginInlineStart: spacing.xs,
  },
  summary: {
    'cursor': 'pointer',
    ':focus-visible': {
      outlineColor: colors.focus,
      outlineWidth: controls.focusWidth,
      outlineStyle: 'solid',
      outlineOffset: 2,
    },
  },
  key: { color: colors.muted },
  string: { color: colors.accent },
  value: { color: colors.ink },
  truncated: { color: colors.muted, fontFamily: typography.fontFamily },
});

const STRING_PREVIEW_CHARACTERS = 500;

function JsonEntry({ value, name, path, depth, maxDepth, maxEntries }: JsonEntryProps): ReactNode {
  const [isExpanded, setExpanded] = useState(depth === 0);

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
    <details
      open={isExpanded}
      onToggle={(event) => setExpanded(event.currentTarget.open)}
      {...stylex.props(styles.entry)}
    >
      <summary {...stylex.props(styles.summary)}>
        <span {...stylex.props(styles.key)}>{name}: </span>
        {Array.isArray(value) ? '[]' : '{}'} <span {...stylex.props(styles.truncated)}>{summary}</span>
      </summary>
      {isExpanded && (
        <div {...stylex.props(styles.children)}>
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
      )}
    </details>
  );
}

export function JsonViewer({ value, label, maxDepth = 6, maxEntries = 50 }: JsonViewerProps): ReactNode {
  const copyValue = useCallback(() => JSON.stringify(value, null, 2), [value]);

  return (
    <section aria-label={label} {...stylex.props(styles.root)}>
      <div {...stylex.props(styles.header)}>
        <span>{label}</span>
        <CopyValue label={label} value={copyValue}>
          Copy JSON
        </CopyValue>
      </div>
      <div role="region" aria-label={`${label} fields`} tabIndex={0} {...stylex.props(styles.body)}>
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
