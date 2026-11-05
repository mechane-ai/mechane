import { IconButton } from '@mechane-ai/elements';
import { Tooltip } from '@mechane-ai/elements/overlays';
import { Pin, PinOff } from 'lucide-react';
import type { ReactNode } from 'react';

export function MechPinButton({
  name,
  pinned,
  onToggle,
}: {
  readonly name: string;
  readonly pinned: boolean;
  readonly onToggle: () => void;
}): ReactNode {
  const label = `${pinned ? 'Unpin' : 'Pin'} ${name}`;

  return (
    <Tooltip.Root>
      <Tooltip.Trigger
        render={<IconButton variant="ghost" aria-label={label} aria-pressed={pinned} onClick={onToggle} />}
      >
        {pinned ? <PinOff size={16} aria-hidden /> : <Pin size={16} aria-hidden />}
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Positioner>
          <Tooltip.Popup>{label}</Tooltip.Popup>
        </Tooltip.Positioner>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}
