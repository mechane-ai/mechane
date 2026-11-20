import * as stylex from '@stylexjs/stylex';
import { Tree, treeFromPaths, TreeItem, TreeItemIndicator, TreeItemLabel, visibleTreeRows } from '@ui-sdk/react/tree';
import { ChevronRight, File, Folder } from 'lucide-react';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Text } from '../../../core/src/index.ts';
import { Input } from '../../../forms/src/index.ts';
import { conditions } from '../../../foundations/src/constants.stylex.ts';
import { colors, controls, spacing } from '../../../foundations/src/tokens.stylex.ts';
import { viewerStyles } from '../viewer-styles.ts';
import type { FileTreeProps } from './file-tree-types.ts';

const styles = stylex.create({
  body: (height: number) => ({ height, minWidth: 0, display: 'flex', flexDirection: 'column' }),
  search: { paddingBlock: spacing.sm, paddingInline: spacing.md, display: 'grid', gap: spacing.xs },
  viewport: { minHeight: 0, flex: 1, overflow: 'auto' },
  tree: (height: number) => ({ height, minWidth: 0, position: 'relative' }),
  row: (top: number, height: number, depth: number) => ({
    'position': 'absolute',
    top,
    height,
    'insetInline': 0,
    'paddingInlineStart': `calc(${spacing.sm} + ${depth} * ${spacing.lg})`,
    'paddingInlineEnd': spacing.sm,
    'display': 'flex',
    'alignItems': 'stretch',
    'cursor': 'pointer',
    'backgroundColor': {
      'default': null,
      ':is([aria-selected="true"])': colors.accentSoft,
      ':hover': { default: null, [conditions.hoverPointer]: colors.canvas },
    },
    ':focus-visible': {
      outlineColor: colors.focus,
      outlineStyle: 'solid',
      outlineWidth: controls.focusWidth,
      outlineOffset: -2,
    },
  }),
  label: { minWidth: 0, width: '100%', display: 'flex', alignItems: 'center', gap: spacing.xs },
  indicator: {
    flexShrink: 0,
    display: 'inline-flex',
    transform: { 'default': null, ':is([data-expanded])': 'rotate(90deg)' },
  },
  icon: { flexShrink: 0, color: colors.muted },
  filename: { minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  status: { flexShrink: 0, marginInlineStart: 'auto', color: colors.muted },
});

function parentFolders(paths: ReadonlyArray<string>): Array<string> {
  const folders = new Set<string>();

  for (const path of paths) {
    for (let slash = path.indexOf('/'); slash !== -1; slash = path.indexOf('/', slash + 1)) {
      folders.add(path.slice(0, slash));
    }
  }

  return [...folders];
}

function FileList({
  paths,
  label,
  selectedPaths,
  onSelectedPathsChange,
  statuses,
  height = 320,
}: FileTreeProps): ReactNode {
  const treeId = useId();
  const viewport = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState('');
  const [scrollTop, setScrollTop] = useState(0);
  const [rowHeight, setRowHeight] = useState(32);
  const normalized = query.trim().toLowerCase();

  const matching = useMemo(
    () => (normalized.length > 0 ? paths.filter((path) => path.toLowerCase().includes(normalized)) : paths),
    [normalized, paths],
  );

  const items = useMemo(() => treeFromPaths(matching.toSorted()), [matching]);

  const [openFolders, setOpenFolders] = useState(() =>
    items.filter((item) => item.children !== undefined).map((item) => item.value),
  );

  const [closedResults, setClosedResults] = useState<ReadonlySet<string>>(() => new Set());
  const resultFolders = useMemo(() => (normalized.length > 0 ? parentFolders(matching) : []), [normalized, matching]);

  const expanded = useMemo(
    () => (normalized.length > 0 ? resultFolders.filter((path) => !closedResults.has(path)) : openFolders),
    [closedResults, normalized, openFolders, resultFolders],
  );

  const rows = useMemo(() => visibleTreeRows(items, expanded), [items, expanded]);
  const changes = useMemo(() => new Map(statuses?.map(({ path, status }) => [path, status])), [statuses]);
  const start = Math.max(0, Math.floor(scrollTop / rowHeight) - 4);
  const end = Math.ceil((scrollTop + height) / rowHeight) + 4;

  useEffect(() => {
    const pointer = globalThis.matchMedia(conditions.coarsePointer.slice('@media '.length));

    function update(): void {
      setRowHeight(pointer.matches ? 44 : 32);
    }

    update();
    pointer.addEventListener('change', update);

    return () => pointer.removeEventListener('change', update);
  }, []);

  function search(value: string): void {
    setQuery(value);
    setClosedResults(new Set());

    if (viewport.current !== null) {
      viewport.current.scrollTop = 0;
    }

    setScrollTop(0);
  }

  function reveal(index: number): void {
    const node = viewport.current;

    if (node === null) {
      return;
    }

    const top = index * rowHeight;

    if (top < node.scrollTop) {
      node.scrollTop = top;
    } else if (top + rowHeight > node.scrollTop + node.clientHeight) {
      node.scrollTop = top + rowHeight - node.clientHeight;
    }

    setScrollTop(node.scrollTop);
  }

  function updateExpanded(next: Array<string>): void {
    if (normalized.length > 0) {
      const open = new Set(next);

      setClosedResults(new Set(resultFolders.filter((path) => !open.has(path))));
    } else {
      setOpenFolders(next);
    }
  }

  return (
    <div {...stylex.props(styles.body(height))}>
      <div {...stylex.props(styles.search)}>
        <Input
          type="search"
          aria-label={`Search ${label}`}
          aria-controls={items.length > 0 ? treeId : undefined}
          placeholder="Search files…"
          value={query}
          onValueChange={search}
          onKeyDown={(event) => {
            if (event.key === 'Escape' && query.length > 0) {
              event.preventDefault();
              search('');
            }
          }}
        />
        {normalized.length > 0 && (
          <Text variant="caption" tone="muted" role="status">
            {matching.length > 0 ? `${matching.length} matches` : 'No matching files.'}
          </Text>
        )}
      </div>
      {items.length > 0 && (
        <div
          ref={viewport}
          {...stylex.props(styles.viewport)}
          onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
        >
          <Tree
            id={treeId}
            aria-label={label}
            mode="multiple"
            items={items}
            expanded={expanded}
            onExpandedChange={updateExpanded}
            value={[...selectedPaths]}
            onValueChange={onSelectedPathsChange}
            onHighlight={(_value, { index }) => reveal(index)}
            {...stylex.props(styles.tree(rows.length * rowHeight))}
          >
            {rows.slice(start, end).map(({ item, level, index }) => (
              <TreeItem
                key={item.value}
                value={item.value}
                label={item.label}
                branch={item.children !== undefined}
                {...stylex.props(styles.row(index * rowHeight, rowHeight, level - 1))}
              >
                <TreeItemLabel {...stylex.props(styles.label)}>
                  {item.children !== undefined && (
                    <TreeItemIndicator {...stylex.props(styles.indicator)}>
                      <ChevronRight size={14} aria-hidden />
                    </TreeItemIndicator>
                  )}
                  {item.children === undefined ? (
                    <File size={14} aria-hidden {...stylex.props(styles.icon)} />
                  ) : (
                    <Folder size={14} aria-hidden {...stylex.props(styles.icon)} />
                  )}
                  <span title={item.value} {...stylex.props(styles.filename)}>
                    {item.label}
                  </span>
                  {changes.has(item.value) && <span {...stylex.props(styles.status)}>{changes.get(item.value)}</span>}
                </TreeItemLabel>
              </TreeItem>
            ))}
          </Tree>
        </div>
      )}
    </div>
  );
}

export function FileTree(props: FileTreeProps): ReactNode {
  return (
    <section aria-label={props.label} {...stylex.props(viewerStyles.root)}>
      <div {...stylex.props(viewerStyles.header)}>
        <span {...stylex.props(viewerStyles.label)}>{props.label}</span>
      </div>
      {props.paths.length === 0 ? <p {...stylex.props(viewerStyles.note)}>No files.</p> : <FileList {...props} />}
    </section>
  );
}
