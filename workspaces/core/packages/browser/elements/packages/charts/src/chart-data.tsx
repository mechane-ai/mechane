import * as stylex from '@stylexjs/stylex';
import type { ReactNode } from 'react';
import { TextButton } from '../../core/src/index.ts';
import { spacing } from '../../foundations/src/tokens.stylex.ts';
import { useScrollTabIndex } from '../../foundations/src/use-scroll-tab-index.ts';
import { Dialog } from '../../overlays/src/index.ts';

const styles = stylex.create({ content: { minWidth: 0, maxHeight: 400, overflow: 'auto', marginBlock: spacing.md } });

export function ChartData({ title, children }: { readonly title: string; readonly children: ReactNode }): ReactNode {
  const scroll = useScrollTabIndex<HTMLDivElement>();

  return (
    <Dialog.Root>
      <Dialog.Trigger render={<TextButton density="compact" />}>Chart data</Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Backdrop />
        <Dialog.Popup>
          <Dialog.Title>{title}</Dialog.Title>
          <div
            ref={scroll.ref}
            role="region"
            aria-label="Chart values"
            tabIndex={scroll.tabIndex}
            {...stylex.props(styles.content)}
          >
            {children}
          </div>
          <Dialog.Close render={<TextButton />}>Close</Dialog.Close>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
