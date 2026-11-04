import type { ReactNode } from 'react';

export type DiffFile = { readonly name: string; readonly code: string; readonly language?: string | undefined };

export type DiffAnnotation = {
  readonly file: string;
  readonly side: 'old' | 'new';
  readonly line: number;
  readonly content: ReactNode;
};

export type DiffSource =
  | { readonly patch: string; readonly before?: never; readonly after?: never }
  | { readonly patch?: never; readonly before: DiffFile; readonly after: DiffFile | null }
  | { readonly patch?: never; readonly before: null; readonly after: DiffFile };

export type DiffViewerProps = DiffSource & {
  readonly label: string;
  readonly layout?: 'unified' | 'split';
  readonly wrap?: boolean;
  readonly annotations?: ReadonlyArray<DiffAnnotation>;
  readonly maxHeight?: number;
};
