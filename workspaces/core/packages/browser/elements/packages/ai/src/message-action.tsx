import type { ComponentProps, ReactElement, ReactNode } from 'react';
import { IconButton, IconLink } from '../../core/src/index.ts';
import { Tooltip } from '../../overlays/src/index.ts';

export type MessageActionProps = { readonly label: string } & (
  | (Omit<ComponentProps<typeof IconButton>, 'aria-label' | 'variant' | 'nativeButton'> & { readonly kind?: 'button' })
  | (Omit<ComponentProps<typeof IconLink>, 'aria-label'> & { readonly kind: 'link' })
);

function messageControl(props: MessageActionProps): ReactElement {
  if (props.kind === 'link') {
    const { kind: _kind, label, ...linkProps } = props;

    return <IconLink {...linkProps} aria-label={label} />;
  }

  const { kind: _kind, label, ...buttonProps } = props;

  return <IconButton {...buttonProps} variant="ghost" aria-label={label} />;
}

export function MessageAction(props: MessageActionProps): ReactNode {
  return (
    <Tooltip.Root>
      <Tooltip.Trigger render={messageControl(props)} />
      <Tooltip.Portal>
        <Tooltip.Positioner>
          <Tooltip.Popup>{props.label}</Tooltip.Popup>
        </Tooltip.Positioner>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}
