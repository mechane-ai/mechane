import { parseDiffFromFile, parsePatchFiles, registerCustomTheme, Virtualizer } from '@pierre/diffs';
import type { FileContents, FileDiffMetadata } from '@pierre/diffs';
import { FileDiff, VirtualizerContext } from '@pierre/diffs/react';
import * as stylex from '@stylexjs/stylex';
import type { ReactNode } from 'react';
import { useCallback, useState } from 'react';
import { highlightTheme, pierreCSS } from '../pierre-theme.ts';
import type { DiffAnnotation, DiffFile, DiffSource } from './diff-source.ts';

type PierreDiffProps = {
  readonly files: ReadonlyArray<FileDiffMetadata>;
  readonly layout: 'unified' | 'split';
  readonly wrap: boolean;
  readonly annotations: ReadonlyArray<DiffAnnotation>;
  readonly maxHeight: number;
  readonly label: string;
};

const styles = stylex.create({ viewport: (maxHeight: number) => ({ maxHeight, overflow: 'auto' }) });

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

export function PierreDiff({ files, layout, wrap, annotations, maxHeight, label }: PierreDiffProps): ReactNode {
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
        {...stylex.props(styles.viewport(maxHeight))}
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
                hunkSeparators: 'line-info',
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
              renderAnnotation={(annotation) => annotation.metadata}
            />
          ))}
        </div>
      </div>
    </VirtualizerContext.Provider>
  );
}
