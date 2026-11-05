import * as stylex from '@stylexjs/stylex';
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { TextButton } from '../../../core/src/index.ts';
import { spacing } from '../../../foundations/src/tokens.stylex.ts';
import { viewerStyles } from '../viewer-styles.ts';
import type { FileTreeProps } from './file-tree-types.ts';
import type { PierreTree } from './pierre-tree.tsx';

type TreeRenderer = { readonly Component: typeof PierreTree | null; readonly hasFailed: boolean };
const FALLBACK_PATHS = 200;

const styles = stylex.create({
  paths: (height: number) => ({
    margin: 0,
    padding: spacing.sm,
    listStyleType: 'none',
    maxHeight: height,
    overflow: 'auto',
  }),
  path: { paddingBlock: spacing.xxs, minWidth: 0, overflowWrap: 'anywhere' },
});

export function FileTree(props: FileTreeProps): ReactNode {
  const [renderer, setRenderer] = useState<TreeRenderer>({ Component: null, hasFailed: false });
  const { label, paths, selectedPaths, onSelectedPathsChange, height = 320 } = props;

  useEffect(() => {
    let isCurrent = true;

    async function load(): Promise<void> {
      try {
        const module = await import('./pierre-tree.tsx');

        if (isCurrent) {
          setRenderer({ Component: module.PierreTree, hasFailed: false });
        }
      } catch {
        if (isCurrent) {
          setRenderer({ Component: null, hasFailed: true });
        }
      }
    }

    void load();

    return () => {
      isCurrent = false;
    };
  }, []);

  return (
    <section aria-label={label} {...stylex.props(viewerStyles.root)}>
      <div {...stylex.props(viewerStyles.header)}>
        <span {...stylex.props(viewerStyles.label)}>{label}</span>
      </div>
      {paths.length === 0 ? (
        <p {...stylex.props(viewerStyles.note)}>No files.</p>
      ) : renderer.Component === null ? (
        <>
          {renderer.hasFailed && (
            <p {...stylex.props(viewerStyles.note)}>Tree navigation is unavailable. Select a path below.</p>
          )}
          <ul
            aria-label={`${label} paths`}
            tabIndex={0}
            {...stylex.props(viewerStyles.scrollRegion, styles.paths(height))}
          >
            {paths.slice(0, FALLBACK_PATHS).map((path) => (
              <li key={path} {...stylex.props(styles.path)}>
                <TextButton aria-pressed={selectedPaths.includes(path)} onClick={() => onSelectedPathsChange([path])}>
                  {path}
                </TextButton>
              </li>
            ))}
          </ul>
          {paths.length > FALLBACK_PATHS && (
            <p {...stylex.props(viewerStyles.note)}>
              {paths.length - FALLBACK_PATHS} paths omitted until tree navigation loads.
            </p>
          )}
        </>
      ) : (
        <renderer.Component {...props} />
      )}
    </section>
  );
}
