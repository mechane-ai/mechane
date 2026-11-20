import { definePrimitive } from '@ui-sdk/core';
import { createParts } from '@ui-sdk/react/primitive';
import type { PartProps } from '@ui-sdk/react/primitive';
import type { ComponentType } from 'react';

const pageTitle = definePrimitive({
  name: 'page-title',
  state: () => ({}),
  api: () => ({}),
  slots: (slot) => ({ root: slot({}) }),
});

export const PageTitle: ComponentType<Omit<PartProps<'h1'>, 'id'>> = createParts(pageTitle, { root: 'h1' }).Root;

type ReadingPosition = { readonly section: HTMLElement | null };

function atReadingPosition({ section }: ReadingPosition): boolean {
  if (section === null) {
    return false;
  }

  const viewport = section.closest('[data-page-viewport]');
  const top = Math.max(0, viewport?.getBoundingClientRect().top ?? 0);
  const bounds = section.getBoundingClientRect();

  return bounds.top <= top && bounds.bottom > top;
}

const pageSection = definePrimitive({
  name: 'page-section',
  state: (): ReadingPosition => ({ section: null }),
  api: () => ({}),
  agent: { actions: [], shown: atReadingPosition },
  slots: (slot) => ({
    root: slot({
      bind(section, { store }) {
        store.set({ section });
      },
    }),
  }),
});

export const ReadingSection: ComponentType<Omit<PartProps<'section'>, 'id'>> = createParts(pageSection, {
  root: 'section',
}).Root;
