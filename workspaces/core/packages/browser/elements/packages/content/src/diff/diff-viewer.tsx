import type { FileDiffMetadata } from '@pierre/diffs';
import * as stylex from '@stylexjs/stylex';
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Collapsible, CopyValue, TextButton } from '../../../core/src/index.ts';
import { spacing } from '../../../foundations/src/tokens.stylex.ts';
import { CodeBlock } from '../code/code-block.tsx';
import { viewerStyles } from '../viewer-styles.ts';
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
  sources: { display: 'flex', flexDirection: 'column', gap: spacing.md, minWidth: 0 },
  preview: { padding: spacing.md },
  disclosure: { paddingInline: spacing.md },
});

type SourcePreviewProps = { readonly source: DiffSource; readonly maxHeight: number };

function SourcePreview({ source, maxHeight }: SourcePreviewProps): ReactNode {
  if (source.patch !== undefined) {
    return <CodeBlock code={source.patch} language="diff" filename="Patch" maxHeight={maxHeight} />;
  }

  return (
    <div {...stylex.props(styles.sources)}>
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
    </div>
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
  const {
    label,
    layout = 'split',
    shouldWrap = false,
    annotations = [],
    maxHeight = 480,
    patch,
    before,
    after,
  } = props;

  const [source, setSource] = useState<DiffSource>(props);
  const [result, setResult] = useState<DiffResult>();
  const [showUnchanged, setShowUnchanged] = useState(false);
  const hasFullContext = patch === undefined && before !== null && after !== null;

  const hasSameBefore =
    before?.name === source.before?.name &&
    before?.code === source.before?.code &&
    before?.language === source.before?.language;

  const hasSameAfter =
    after?.name === source.after?.name &&
    after?.code === source.after?.code &&
    after?.language === source.after?.language;

  if (patch !== source.patch || !hasSameBefore || !hasSameAfter) {
    setSource(props);
  }

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
    <section aria-label={label} {...stylex.props(viewerStyles.root)}>
      <div {...stylex.props(viewerStyles.header)}>
        <span {...stylex.props(viewerStyles.label)}>{label}</span>
        <div {...stylex.props(viewerStyles.actions)}>
          {hasFullContext && (
            <TextButton
              disabled={current === undefined || current.Component === null}
              onClick={() => setShowUnchanged(!showUnchanged)}
            >
              {showUnchanged ? 'Show changes only' : 'Show unchanged lines'}
            </TextButton>
          )}
          {patch !== undefined && (
            <CopyValue value={patch} label={label}>
              Copy patch
            </CopyValue>
          )}
        </div>
      </div>
      {current !== undefined && current.Component !== null ? (
        <>
          <current.Component
            files={current.files}
            label={label}
            layout={layout}
            shouldWrap={shouldWrap}
            showUnchanged={hasFullContext && showUnchanged}
            annotations={annotations}
            maxHeight={maxHeight}
          />
          <SourceDisclosure source={source} maxHeight={maxHeight} />
        </>
      ) : (
        <>
          {(isBounded || current !== undefined) && (
            <div {...stylex.props(viewerStyles.note)}>
              {isBounded
                ? 'This diff exceeds the rendering limit. Supplied source is shown below.'
                : 'Diff rendering is unavailable. Supplied source is shown below.'}
            </div>
          )}
          <div {...stylex.props(styles.preview)}>
            <SourcePreview source={source} maxHeight={maxHeight} />
          </div>
        </>
      )}
      {hasNoChanges && <div {...stylex.props(viewerStyles.note)}>No file changes in this patch.</div>}
    </section>
  );
}
