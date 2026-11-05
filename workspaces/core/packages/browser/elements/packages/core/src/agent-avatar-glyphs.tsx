import type { ReactNode } from 'react';

export const seededAgentAvatarShapes = Object.freeze([
  'spark',
  'facet',
  'orbit',
  'loop',
  'clover',
  'petal',
  'wheel',
  'compass',
  'grid',
  'steps',
  'chevron',
  'wave',
  'ripple',
  'arch',
  'bridge',
  'peak',
  'zigzag',
  'helix',
  'kite',
  'cube',
  'prism',
  'frame',
  'brackets',
  'diamond',
  'hexagon',
  'signal',
  'crest',
  'bolt',
  'link',
  'split',
  'aster',
  'portal',
] as const);

export const agentAvatarShapes = Object.freeze([...seededAgentAvatarShapes] as const);

export type AgentAvatarShape = (typeof agentAvatarShapes)[number];

export const agentAvatarGlyphs: Readonly<Record<AgentAvatarShape, ReactNode>> = {
  spark: <path d="M12 2 14.6 8.4 21 11 14.6 13.6 12 20 9.4 13.6 3 11 9.4 8.4Z" fill="currentColor" stroke="none" />,
  facet: (
    <>
      <path d="m12 2 9 7-9 13L3 9Z" />
      <path d="m3 9 9 4 9-4M12 2v11l-5-7m5 7 5-7" />
    </>
  ),
  orbit: (
    <>
      <ellipse cx="12" cy="12" rx="10" ry="5" transform="rotate(-35 12 12)" />
      <circle cx="12" cy="12" r="3" fill="currentColor" stroke="none" />
    </>
  ),
  loop: <path d="M12 7C7-1 1 7 5 12s7 9 11 7 7-8 3-11-7 3-7 7S5 20 4 15 8 7 12 7Zm0 0c5 0 8 4 7 8" />,
  clover: (
    <path
      d="M12 9C2-4-4 12 9 12-4 22 12 28 12 15c10 13 16-3 3-3C28 2 12-4 12 9Z"
      fill="currentColor"
      stroke="none"
      transform="translate(2 2) scale(.83)"
    />
  ),
  petal: (
    <>
      <path d="M12 21C1 15 2 6 5 3c4 1 7 5 7 9 0-4 3-8 7-9 3 3 4 12-7 18Z" />
      <path d="M12 12v9M5 3l7 9 7-9" />
    </>
  ),
  wheel: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 3.5V9m0 6v5.5M3.5 12H9m6 0h5.5M6 6l4 4m4 4 4 4M6 18l4-4m4-4 4-4" />
      <circle cx="12" cy="12" r="2" fill="currentColor" stroke="none" />
    </>
  ),
  compass: (
    <>
      <path d="m12 2 4 6 6 4-6 4-4 6-4-6-6-4 6-4Z" />
      <path d="m12 6 2 6-2 6-2-6Z" fill="currentColor" stroke="none" />
    </>
  ),
  grid: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="1" fill="currentColor" stroke="none" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" fill="currentColor" stroke="none" />
    </>
  ),
  steps: <path d="M3 21V9h6V3h12v6h-6v6H9v6ZM9 9h6v6" />,
  chevron: (
    <>
      <path d="m3 6 9 6 9-6M3 12l9 6 9-6" />
      <path d="m3 3 9 6 9-6" opacity=".5" />
    </>
  ),
  wave: (
    <>
      <path d="M2 7c4-8 7 8 11 0s7 8 9 0M2 12c4-8 7 8 11 0s7 8 9 0M2 17c4-8 7 8 11 0s7 8 9 0" />
    </>
  ),
  ripple: (
    <>
      <path d="M3 18a9 9 0 1 1 18 0M7 18a5 5 0 1 1 10 0" />
      <circle cx="12" cy="17" r="1.5" fill="currentColor" stroke="none" />
    </>
  ),
  arch: (
    <>
      <path d="M3 21V11a9 9 0 0 1 18 0v10h-6V11a3 3 0 0 0-6 0v10Z" />
      <path d="M3 16h6m6-9 5-2" />
    </>
  ),
  bridge: (
    <>
      <path d="M3 20V4h5v5h8V4h5v16h-5v-6H8v6Z" fill="currentColor" stroke="none" />
    </>
  ),
  peak: (
    <>
      <path d="M2 20 9 4l5 10 3-6 5 12Z" />
      <path d="m6 11 3 3 3-3M14 20l3-6 3 6" />
    </>
  ),
  zigzag: <path d="M3 3h7l4 6 4-6h4l-8 12-4-6-3 4 7 8H7l-6-8 6-8" />,
  helix: (
    <>
      <path d="M5 2c18 6-4 14 14 20M19 2C1 8 23 16 5 22M8 5h8M8 19h8M9 10h6m-6 4h6" />
    </>
  ),
  kite: (
    <>
      <path d="m12 2 8 9-8 11-8-11Z" />
      <path d="M12 2v20M4 11h16" />
    </>
  ),
  cube: (
    <>
      <path d="m12 2 9 5v10l-9 5-9-5V7Z" />
      <path d="m3 7 9 5 9-5M12 12v10" />
    </>
  ),
  prism: (
    <>
      <path d="M3 20 12 3l9 17Z" />
      <path d="m12 3 2 17M3 20l8-7 10 7" />
    </>
  ),
  frame: (
    <>
      <path d="M3 9V3h6m6 0h6v6m0 6v6h-6m-6 0H3v-6" />
      <rect x="8" y="8" width="8" height="8" rx="2" fill="currentColor" stroke="none" />
    </>
  ),
  brackets: (
    <>
      <path d="m8 3-6 9 6 9m8-18 6 9-6 9" />
      <path d="m14 6-4 12" />
    </>
  ),
  diamond: (
    <>
      <path d="m12 2 10 10-10 10L2 12Z" />
      <path d="m12 7 5 5-5 5-5-5Z" fill="currentColor" stroke="none" />
    </>
  ),
  hexagon: (
    <>
      <path d="m7 3 10 0 5 9-5 9H7l-5-9Z" />
      <path d="M7 3v9l10 9V12ZM2 12h5m10 0h5" />
    </>
  ),
  signal: (
    <>
      <rect x="3" y="13" width="4" height="8" rx="1" fill="currentColor" stroke="none" />
      <rect x="10" y="8" width="4" height="13" rx="1" fill="currentColor" stroke="none" />
      <rect x="17" y="3" width="4" height="18" rx="1" fill="currentColor" stroke="none" />
    </>
  ),
  crest: (
    <>
      <path d="M3 4h18v7c0 5-5 9-9 11-4-2-9-6-9-11Z" />
      <path d="M7 8h10M7 12h10m-10 4h7" />
    </>
  ),
  bolt: <path d="M13 2 3 14h7l-1 8L21 9h-8Z" fill="currentColor" stroke="none" />,
  link: (
    <>
      <path
        d="m9 15-3 3a4 4 0 0 1-6-6l6-6a4 4 0 0 1 6 0m0 3 3-3a4 4 0 0 1 6 6l-6 6a4 4 0 0 1-6 0"
        transform="translate(1.5 0)"
      />
      <path d="m8 16 8-8" />
    </>
  ),
  split: (
    <>
      <path d="M3 3h8v8H3Zm10 10h8v8h-8Z" fill="currentColor" stroke="none" />
      <path d="m14 3 7 7m-7-7v7h7M3 14l7 7m-7-7v7h7" />
    </>
  ),
  aster: (
    <>
      <path d="M12 2v20M3.3 7l17.4 10M3.3 17 20.7 7" strokeWidth="3.5" />
      <circle cx="12" cy="12" r="3" fill="currentColor" stroke="none" />
    </>
  ),
  portal: (
    <>
      <ellipse cx="12" cy="12" rx="9" ry="10" />
      <ellipse cx="12" cy="12" rx="4" ry="10" />
      <path d="M3 12h18" />
    </>
  ),
};
