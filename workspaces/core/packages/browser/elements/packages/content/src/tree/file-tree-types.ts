export type FileStatus = {
  readonly path: string;
  readonly status: 'added' | 'deleted' | 'ignored' | 'modified' | 'renamed' | 'untracked';
};

export type FileTreeProps = {
  readonly paths: ReadonlyArray<string>;
  readonly label: string;
  readonly selectedPaths: ReadonlyArray<string>;
  readonly onSelectedPathsChange: (paths: ReadonlyArray<string>) => void;
  readonly statuses?: ReadonlyArray<FileStatus>;
  readonly height?: number;
};
