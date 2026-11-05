import { parseDiffFromFile, parsePatchFiles, registerCustomTheme, Virtualizer } from '@pierre/diffs';
import type { FileContents, FileDiffMetadata } from '@pierre/diffs';
import { FileDiff, VirtualizerContext } from '@pierre/diffs/react';
import * as stylex from '@stylexjs/stylex';
import type { ReactNode } from 'react';
import { useCallback, useState } from 'react';
import { spacing, typography } from '../../../foundations/src/tokens.stylex.ts';
import { highlightTheme, pierreCSS } from '../pierre-theme.ts';
import { viewerStyles } from '../viewer-styles.ts';
import type { DiffAnnotation, DiffFile, DiffSource } from './diff-source.ts';

type PierreDiffProps = {
  readonly files: ReadonlyArray<FileDiffMetadata>;
  readonly layout: 'unified' | 'split';
  readonly wrap: boolean;
  readonly showUnchanged: boolean;
  readonly annotations: ReadonlyArray<DiffAnnotation>;
  readonly maxHeight: number;
  readonly label: string;
};

const styles = stylex.create({
  viewport: (maxHeight: number) => ({ maxHeight, overflow: 'auto' }),
  annotation: {
    padding: spacing.md,
    minWidth: 0,
    fontFamily: typography.fontFamily,
    fontSize: typography.bodySize,
    lineHeight: typography.bodyLineHeight,
    overflowWrap: 'anywhere',
  },
});

registerCustomTheme('mechane', () => Promise.resolve(highlightTheme), 'zed');

function pierreFile(file: DiffFile | null): FileContents | null {
  if (file === null) {
    return null;
  }

  return { name: file.name, contents: file.code, lang: file.language ?? 'text' };
}

export function prepareDiff(source: DiffSource): ReadonlyArray<FileDiffMetadata> {
  if (source.patch !== undefined) {
    return parsePatchFiles(source.patch, { throwOnError: true }).flatMap((patch) => patch.files);
  }

  return [parseDiffFromFile(pierreFile(source.before), pierreFile(source.after), {}, true)];
}

export function PierreDiff({
  files,
  layout,
  wrap,
  showUnchanged,
  annotations,
  maxHeight,
  label,
}: PierreDiffProps): ReactNode {
  const [virtualizer] = useState(() => new Virtualizer());

  const viewport = useCallback(
    (node: HTMLDivElement | null) => {
      if (node === null) {
        virtualizer.cleanUp();
      } else {
        virtualizer.setup(node);
      }
    },
    [virtualizer],
  );

  return (
    <VirtualizerContext.Provider value={virtualizer}>
      <div
        ref={viewport}
        role="region"
        aria-label={`${label} changes`}
        tabIndex={0}
        {...stylex.props(viewerStyles.scrollRegion, styles.viewport(maxHeight))}
      >
        <div>
          {files.map((file) => (
            <FileDiff<ReactNode>
              key={file.name}
              fileDiff={file}
              disableWorkerPool
              options={{
                preferredHighlighter: 'highlights',
                theme: 'mechane',
                themeType: 'system',
                unsafeCSS: pierreCSS,
                diffStyle: layout,
                overflow: wrap ? 'wrap' : 'scroll',
                // The header control replaces Pierre's pointer-only hunk expanders.
                hunkSeparators: 'metadata',
                expandUnchanged: showUnchanged,
                tokenizeMaxLength: 200_000,
                tokenizeMaxLineLength: 4096,
              }}
              lineAnnotations={annotations
                .filter((annotation) => annotation.file === file.name)
                .map((annotation) => ({
                  side: annotation.side === 'old' ? 'deletions' : 'additions',
                  lineNumber: annotation.line,
                  metadata: annotation.content,
                }))}
              renderAnnotation={(annotation) => <div {...stylex.props(styles.annotation)}>{annotation.metadata}</div>}
            />
          ))}
        </div>
      </div>
    </VirtualizerContext.Provider>
  );
}
