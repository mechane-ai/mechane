import type { toCard } from '@json-render/chat';
import { renderPresentationCard } from './render-presentation-card.ts';
import { PresentationSpecification } from './schemas.ts';

type ToPresentationCardInput = { readonly spec: unknown };

/** Complete validation rejects content that a native renderer could otherwise prune or silently degrade. */
export function toPresentationCard({ spec }: ToPresentationCardInput): ReturnType<typeof toCard> {
  const parsed = PresentationSpecification.parse(spec);

  return renderPresentationCard({ spec: parsed });
}
