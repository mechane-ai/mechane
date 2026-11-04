import { FileTree as PierreFileTree, useFileTree, useFileTreeSearch } from '@pierre/trees/react';
import * as stylex from '@stylexjs/stylex';
import { useEffect, useId, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Input, Text } from '../../../core/src/index.ts';
import { conditions, spacing } from '../../../core/src/tokens.stylex.ts';
import { treeCSS } from '../pierre-theme.ts';
import type { FileTreeProps } from './file-tree-types.ts';

const styles = stylex.create({
  root: (height: number) => ({ display: 'flex', flexDirection: 'column', height, minWidth: 0, overflow: 'hidden' }),
  search: {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.xs,
    paddingBlock: spacing.sm,
    paddingInline: spacing.md,
  },
  tree: { display: 'block', flexGrow: 1, minHeight: 0, minWidth: 0, overflow: 'hidden' },
});

export function PierreTree({
  paths,
  label,
  selectedPaths,
  onSelectedPathsChange,
  statuses,
  height = 320,
}: FileTreeProps): ReactNode {
  const treeId = useId();
  const selection = useRef({ selectedPaths, onSelectedPathsChange });
  const isSyncing = useRef(false);
  const isMounted = useRef(false);

  const [itemHeight] = useState(() =>
    globalThis.matchMedia(conditions.coarsePointer.slice('@media '.length)).matches ? 44 : 32,
  );

  const { model } = useFileTree({
    paths,
    initialSelectedPaths: selectedPaths,
    initialExpansion: 1,
    itemHeight,
    icons: { set: 'minimal', colored: false },
    search: false,
    fileTreeSearchMode: 'hide-non-matches',
    dragAndDrop: false,
    renaming: false,
    unsafeCSS: treeCSS,
    onSelectionChange: selectionChanged,
  });

  const search = useFileTreeSearch(model);
  const hasSearchResults = search.value.length === 0 || search.matchingPaths.length > 0;

  function synchronizeSelection(): void {
    isSyncing.current = true;
    const desired = new Set(selection.current.selectedPaths);

    for (const path of model.getSelectedPaths()) {
      if (!desired.has(path)) {
        const item = model.getItem(path);

        if (item !== null) {
          item.deselect();
        }
      }
    }

    for (const path of desired) {
      const item = model.getItem(path);

      if (item !== null && !item.isSelected()) {
        item.select();
      }
    }

    isSyncing.current = false;
  }

  function selectionChanged(nextPaths: ReadonlyArray<string>): void {
    if (isSyncing.current || !isMounted.current) {
      return;
    }

    selection.current.onSelectedPathsChange(nextPaths);
    queueMicrotask(() => {
      if (isMounted.current) {
        synchronizeSelection();
      }
    });
  }

  useEffect(() => {
    isMounted.current = true;

    return () => {
      isMounted.current = false;
    };
  }, []);

  useEffect(() => {
    selection.current = { selectedPaths, onSelectedPathsChange };

    synchronizeSelection();
  }, [model, selectedPaths, onSelectedPathsChange]);

  useEffect(() => {
    const expandedPaths = model
      .getVisibleRows(0, model.getVisibleCount())
      .filter((row) => row.isExpanded)
      .map((row) => row.path);

    isSyncing.current = true;

    model.resetPaths(paths, { initialExpandedPaths: expandedPaths });
    synchronizeSelection();
  }, [model, paths]);

  useEffect(() => {
    model.setGitStatus(statuses);
  }, [model, statuses]);

  return (
    <div {...stylex.props(styles.root(height))}>
      <div {...stylex.props(styles.search)}>
        <Input
          type="search"
          aria-label={`Search ${label}`}
          aria-controls={hasSearchResults ? treeId : undefined}
          placeholder="Search files…"
          value={search.value}
          onValueChange={search.setValue}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.preventDefault();
              search.close();
            }
          }}
        />
        {search.value.length > 0 && (
          <Text variant="caption" tone="muted" role="status">
            {search.matchingPaths.length === 0 ? 'No matching files.' : `${search.matchingPaths.length} matches`}
          </Text>
        )}
      </div>
      {hasSearchResults && (
        <PierreFileTree id={treeId} model={model} aria-label={label} {...stylex.props(styles.tree)} />
      )}
    </div>
  );
}
