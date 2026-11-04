import type { FileDiffMetadata } from '@pierre/diffs';
import * as stylex from '@stylexjs/stylex';
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Collapsible, CopyValue } from '../../../core/src/index.ts';
import { colors, spacing, typography } from '../../../core/src/tokens.stylex.ts';
import { CodeBlock } from '../code/index.ts';
import type { DiffSource, DiffViewerProps } from './diff-source.ts';
import type { PierreDiff } from './pierre-diff.tsx';

type DiffResult =
  | {
      readonly source: DiffSource;
      readonly Component: typeof PierreDiff;
      readonly files: ReadonlyArray<FileDiffMetadata>;
    }
  | { readonly source: DiffSource; readonly Component: null; readonly files: null };

const MAX_DIFF_CHARACTERS = 500_000;

const styles = stylex.create({
  root: {
    minWidth: 0,
    backgroundColor: colors.surface,
    color: colors.ink,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: colors.line,
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingBlock: spacing.sm,
    paddingInline: spacing.md,
    fontFamily: typography.fontFamily,
    fontSize: typography.bodySize,
    lineHeight: typography.bodyLineHeight,
    borderBlockEndWidth: 1,
    borderBlockEndStyle: 'solid',
    borderBlockEndColor: colors.line,
  },
  note: {
    padding: spacing.md,
    fontFamily: typography.fontFamily,
    fontSize: typography.captionSize,
    lineHeight: typography.bodyLineHeight,
    color: colors.muted,
  },
  disclosure: { paddingInline: spacing.md },
});

type SourcePreviewProps = { readonly source: DiffSource; readonly maxHeight: number };

function SourcePreview({ source, maxHeight }: SourcePreviewProps): ReactNode {
  if (source.patch !== undefined) {
    return <CodeBlock code={source.patch} language="diff" filename="Patch" maxHeight={maxHeight} />;
  }

  return (
    <>
      {source.before !== null && (
        <CodeBlock
          code={source.before.code}
          language={source.before.language}
          filename={`Before · ${source.before.name}`}
          maxHeight={maxHeight}
        />
      )}
      {source.after !== null && (
        <CodeBlock
          code={source.after.code}
          language={source.after.language}
          filename={`After · ${source.after.name}`}
          maxHeight={maxHeight}
        />
      )}
    </>
  );
}

function SourceDisclosure({ source, maxHeight }: SourcePreviewProps): ReactNode {
  return (
    <div {...stylex.props(styles.disclosure)}>
      <Collapsible.Root>
        <Collapsible.Trigger>View supplied source</Collapsible.Trigger>
        <Collapsible.Panel>
          <SourcePreview source={source} maxHeight={maxHeight} />
        </Collapsible.Panel>
      </Collapsible.Root>
    </div>
  );
}

export function DiffViewer(props: DiffViewerProps): ReactNode {
  const { label, layout = 'split', wrap = false, annotations = [], maxHeight = 480, patch, before, after } = props;
  const source: DiffSource = props;
  const [result, setResult] = useState<DiffResult>();

  const sourceLength =
    patch === undefined
      ? (before === null ? 0 : before.code.length) + (after === null ? 0 : after.code.length)
      : patch.length;

  const isBounded = sourceLength > MAX_DIFF_CHARACTERS;

  useEffect(() => {
    let isCurrent = true;

    async function load(): Promise<void> {
      if (isBounded) {
        return;
      }

      try {
        const module = await import('./pierre-diff.tsx');
        const files = module.prepareDiff(source);

        if (isCurrent) {
          setResult({ source, Component: module.PierreDiff, files });
        }
      } catch {
        if (isCurrent) {
          setResult({ source, Component: null, files: null });
        }
      }
    }

    void load();

    return () => {
      isCurrent = false;
    };
  }, [source, isBounded]);

  const current = result !== undefined && result.source === source ? result : undefined;
  const hasNoChanges = current?.files?.length === 0;

  return (
    <section aria-label={label} {...stylex.props(styles.root)}>
      <div {...stylex.props(styles.header)}>
        <span>{label}</span>
        {patch !== undefined && (
          <CopyValue value={patch} label={label}>
            Copy patch
          </CopyValue>
        )}
      </div>
      {current !== undefined && current.Component !== null ? (
        <>
          <current.Component
            files={current.files}
            label={label}
            layout={layout}
            wrap={wrap}
            annotations={annotations}
            maxHeight={maxHeight}
          />
          <SourceDisclosure source={source} maxHeight={maxHeight} />
        </>
      ) : (
        <>
          {(isBounded || current !== undefined) && (
            <div {...stylex.props(styles.note)}>
              {isBounded
                ? 'This diff exceeds the rendering limit. Supplied source is shown below.'
                : 'Diff rendering is unavailable. Supplied source is shown below.'}
            </div>
          )}
          <SourcePreview source={source} maxHeight={maxHeight} />
        </>
      )}
      {hasNoChanges && <div {...stylex.props(styles.note)}>No file changes in this patch.</div>}
    </section>
  );
}
