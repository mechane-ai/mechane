import { IconButton } from '@mechane-ai/elements';
import { Tooltip } from '@mechane-ai/elements/overlays';
import { Pin, PinOff } from 'lucide-react';
import type { ReactNode } from 'react';

export function MechPinButton({
  name,
  isPinned,
  onToggle,
}: {
  readonly name: string;
  readonly isPinned: boolean;
  readonly onToggle: () => void;
}): ReactNode {
  const label = `${isPinned ? 'Unpin' : 'Pin'} ${name}`;

  return (
    <Tooltip.Root>
      <Tooltip.Trigger
        render={<IconButton variant="ghost" aria-label={label} aria-pressed={isPinned} onClick={onToggle} />}
      >
        {isPinned ? <PinOff size={16} aria-hidden /> : <Pin size={16} aria-hidden />}
      </Tooltip.Trigger>
      <Tooltip.Popup>{label}</Tooltip.Popup>
    </Tooltip.Root>
  );
}
