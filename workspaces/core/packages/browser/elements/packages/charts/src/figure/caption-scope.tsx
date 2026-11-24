import { createContext, use } from 'react';
import type { ReactNode } from 'react';

const Captioned = createContext(false);

export type CaptionScopeProps = {
  /** The charts and scenes the surrounding caption describes. */
  readonly children: ReactNode;
};

/**
 * Marks figures whose caption is printed around them, such as inside an article `Figure`. A chart or scene inside keeps
 * its title as its accessible name, and prints neither the title nor the description.
 */
export function CaptionScope({ children }: CaptionScopeProps): ReactNode {
  return <Captioned value>{children}</Captioned>;
}

/** Whether a figure sits in a `CaptionScope`, so its own title and description stay unprinted. */
export function useIsCaptioned(): boolean {
  return use(Captioned);
}
