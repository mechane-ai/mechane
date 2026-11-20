import { createContext, useContext, useSyncExternalStore } from 'react';
import type { ComponentType, ReactNode } from 'react';
import type { OpenStateProperties } from '../../foundations/src/control-state.ts';

export type OpenProps<Props extends { onOpenChange?: (...args: Array<never>) => void }> = Omit<
  Props,
  'open' | 'defaultOpen' | 'onOpenChange'
> &
  OpenStateProperties<NonNullable<Props['onOpenChange']>>;

type PortalContainer = Element | DocumentFragment | null;
const Container = createContext<PortalContainer>(null);

function subscribeToDocumentBody(): () => void {
  return () => undefined;
}

export function withOverlayPortal<Props extends { container?: PortalContainer }>(Root: ComponentType<Props>) {
  return function OverlayRoot(props: Props): ReactNode {
    const parent = useContext(Container);

    const body = useSyncExternalStore(
      subscribeToDocumentBody,
      () => document.body,
      () => null,
    );

    const target = props.container ?? parent ?? body;

    return (
      <Container value={target}>
        <Root {...props} container={target} />
      </Container>
    );
  };
}
