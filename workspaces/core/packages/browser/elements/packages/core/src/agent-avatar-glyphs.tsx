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

export const agentAvatarShapes = Object.freeze([
  ...seededAgentAvatarShapes,
  'rosette',
  'blossom',
  'pinwheel',
  'lantern',
  'lattice',
  'mosaic',
  'dahlia',
  'lotus',
  'mandala',
  'braid',
  'gem',
  'eclipse',
  'gyre',
  'crossweave',
  'tessera',
  'triad',
] as const);

export type AgentAvatarShape = (typeof agentAvatarShapes)[number];

function radial(angles: ReadonlyArray<number>, shape: ReactNode): ReactNode {
  return angles.map((angle) => (
    <g key={angle} transform={`rotate(${angle} 12 12)`}>
      {shape}
    </g>
  ));
}

export const agentAvatarGlyphs: Readonly<Record<AgentAvatarShape, ReactNode>> = {
  spark: radial([0, 45, 90, 135, 180, 225, 270, 315], <path d="m12 2 5.4 7-5.4 6.2-3.4-6.2Z" />),
  facet: radial([0, 72, 144, 216, 288], <path d="m12 2 6 7-6 5-4-5Z" />),
  orbit: (
    <>
      {radial([0, 60, 120], <ellipse cx="12" cy="12" rx="9.2" ry="4.5" fillOpacity=".4" />)}
      <circle cx="12" cy="12" r="2.8" fillOpacity=".75" />
    </>
  ),
  loop: radial([0, 120, 240], <path d="M12 12C3 14 1 8 5 4c4-4 10-1 10 4 0 3-2 5-5 6 3-3 2-6 0-7-3-1-5 2-2 4Z" />),
  clover: radial([0, 90, 180, 270], <circle cx="12" cy="7.4" r="5.3" />),
  petal: radial([0, 72, 144, 216, 288], <path d="M12 2c5 1 6 6 0 10-6-4-5-9 0-10Z" />),
  wheel: (
    <>
      {radial([0, 45, 90, 135, 180, 225, 270, 315], <ellipse cx="12" cy="6.7" rx="3.2" ry="4.6" />)}
      <circle cx="12" cy="12" r="3.2" fillOpacity=".65" />
    </>
  ),
  compass: radial([0, 45, 90, 135, 180, 225, 270, 315], <path d="m12 1.5 3 7-3 3.5-3-3.5Z" />),
  grid: (
    <>
      {radial([0, 90, 180, 270], <circle cx="6.8" cy="6.8" r="3.5" />)}
      {radial([0, 90, 180, 270], <circle cx="12" cy="4.1" r="1.8" fillOpacity=".5" />)}
      <rect x="7.5" y="7.5" width="9" height="9" rx="2" transform="rotate(45 12 12)" />
    </>
  ),
  steps: radial([0, 90, 180, 270], <path d="M4 3h9v5H9v5H4Z" />),
  chevron: radial([0, 90, 180, 270], <path d="m3 8 9-6 9 6-9 6Z" fillOpacity=".48" />),
  wave: (
    <>
      <path d="M2 6c6-8 12 8 20 0v5C14 19 8 3 2 11Z" />
      <path d="M2 11c6-8 12 8 20 0v5c-8 8-14-8-20 0Z" />
      <path d="M2 16c6-8 12 8 20 0v3c-8 8-14-8-20 0Z" fillOpacity=".4" />
    </>
  ),
  ripple: (
    <>
      <circle cx="12" cy="11" r="9.3" fillOpacity=".45" />
      <circle cx="12" cy="13.5" r="6.8" fillOpacity=".5" />
      <circle cx="12" cy="16" r="4.3" fillOpacity=".6" />
    </>
  ),
  arch: (
    <>
      <path d="M2.7 20V11a9.3 9.3 0 0 1 18.6 0v9Z" fillOpacity=".4" />
      <path d="M6 20v-7a6 6 0 0 1 12 0v7Z" fillOpacity=".5" />
      <path d="M9.2 20v-4.5a2.8 2.8 0 0 1 5.6 0V20Z" />
    </>
  ),
  bridge: (
    <>
      <rect x="3" y="6" width="18" height="5" rx="2.5" />
      <rect x="3" y="13" width="18" height="5" rx="2.5" />
      <rect x="6" y="3" width="5" height="18" rx="2.5" fillOpacity=".45" />
      <rect x="13" y="3" width="5" height="18" rx="2.5" fillOpacity=".45" />
    </>
  ),
  peak: radial([0, 120, 240], <path d="M12 2 17 12H7Z" fillOpacity=".6" />),
  zigzag: radial([0, 90, 180, 270], <path d="m3 3 10 3 2 6-5 3 1-7-7 1Z" />),
  helix: (
    <>
      <ellipse cx="9" cy="12" rx="5.3" ry="9.5" transform="rotate(32 9 12)" fillOpacity=".5" />
      <ellipse cx="15" cy="12" rx="5.3" ry="9.5" transform="rotate(32 15 12)" fillOpacity=".5" />
      <path d="m4.5 14.5 9-9 6 4-9 9Z" fillOpacity=".25" />
    </>
  ),
  kite: radial([0, 90, 180, 270], <path d="m12 2 5.3 5.8L12 16 6.7 7.8Z" />),
  cube: (
    <>
      <path d="m12 2.5 9 5.2-9 5.2-9-5.2Z" fillOpacity=".45" />
      <path d="m3 7.7 9 5.2v8.6l-9-5.2Z" fillOpacity=".7" />
      <path d="m21 7.7-9 5.2v8.6l9-5.2Z" fillOpacity=".55" />
      <path d="m7.5 5.1 9 5.2v8.6M16.5 5.1l-9 5.2v8.6M3 12l9 5.2 9-5.2" fill="none" />
    </>
  ),
  prism: (
    <>
      <path d="M12 2 22 19H2Z" fillOpacity=".35" />
      <path d="m12 2 3.5 17H2Z" fillOpacity=".65" />
      <path d="m12 2 10 17H8.5Z" fillOpacity=".45" />
      <path d="m2 19 10-7 10 7Z" fillOpacity=".45" />
    </>
  ),
  frame: radial([0, 90, 180, 270], <rect x="4" y="3" width="11" height="11" rx="3.6" />),
  brackets: radial([0, 90, 180, 270], <path d="M3 4a1 1 0 0 1 1-1h8v4H7v5H3Z" />),
  diamond: (
    <>
      {radial(
        [0, 90, 180, 270],
        <rect x="6.4" y="2.5" width="8" height="8" rx="1.5" transform="rotate(45 10.4 6.5)" />,
      )}
      <circle cx="12" cy="12" r="3" fillOpacity=".5" />
    </>
  ),
  hexagon: radial([0, 60, 120, 180, 240, 300], <path d="m12 2 4 2.3v4.6l-4 2.3-4-2.3V4.3Z" />),
  signal: (
    <>
      <rect x="2.6" y="7.5" width="4.5" height="9" rx="2.2" fillOpacity=".45" />
      <rect x="7.4" y="3.5" width="4.5" height="17" rx="2.2" />
      <rect x="12.1" y="3.5" width="4.5" height="17" rx="2.2" />
      <rect x="16.9" y="7.5" width="4.5" height="9" rx="2.2" fillOpacity=".45" />
      <path d="M2.6 12h18.8" fill="none" />
    </>
  ),
  crest: radial([0, 120, 240], <path d="M6 3h12v5c0 4-3.5 7.2-6 9-2.5-1.8-6-5-6-9Z" fillOpacity=".55" />),
  bolt: radial([0, 120, 240], <path d="m10 2 9 8-7 1 1 6-9-8 7-1Z" fillOpacity=".6" />),
  link: radial(
    [0, 90],
    <path
      d="M12 2c5 0 7 4 7 10s-2 10-7 10-7-4-7-10S7 2 12 2Zm0 4c-2 0-3 2-3 6s1 6 3 6 3-2 3-6-1-6-3-6Z"
      fillRule="evenodd"
      fillOpacity=".6"
    />,
  ),
  split: radial([0, 90, 180, 270], <path d="M12 2a10 10 0 0 1 10 10H9a3 3 0 0 1 3-3Z" fillOpacity=".6" />),
  aster: radial([0, 60, 120], <rect x="9.4" y="1.5" width="5.2" height="21" rx="2.6" fillOpacity=".55" />),
  portal: (
    <>
      <circle cx="12" cy="12" r="9.3" fillOpacity=".4" />
      {radial([0, 90, 180, 270], <circle cx="12" cy="7.6" r="4.8" fillOpacity=".35" />)}
    </>
  ),
  rosette: radial(
    [0, 60, 120, 180, 240, 300],
    <path d="M12 1.8c1.2 5 7 5.8 5.5 10.2-1.1 3.3-5.5 3-5.5 0-4.2-.8-5.1-4.2 0-10.2Z" />,
  ),
  blossom: (
    <>
      {radial([0, 72, 144, 216, 288], <circle cx="12" cy="6.6" r="4.6" />)}
      <circle cx="12" cy="12" r="3.8" fillOpacity=".4" />
    </>
  ),
  pinwheel: radial([0, 72, 144, 216, 288], <path d="M12 12C5 15 1 8 6 3c5-2 8 1 8 5-2-2-5-1-5 1s1 3 3 3Z" />),
  lantern: (
    <>
      {radial([0, 90, 180, 270], <path d="m12 1.5 4 6-4 5-4-5Z" />)}
      {radial([45, 135, 225, 315], <path d="m12 3.5 3 5-3 3.5-3-3.5Z" fillOpacity=".45" />)}
    </>
  ),
  lattice: (
    <>
      {[5, 10, 15].map((position) => (
        <rect key={position} x={position} y="3" width="4" height="18" rx="2" fillOpacity=".45" />
      ))}
      {[5, 10, 15].map((position) => (
        <rect key={position} x="3" y={position} width="18" height="4" rx="2" fillOpacity=".45" />
      ))}
    </>
  ),
  mosaic: (
    <>
      {radial([0, 90, 180, 270], <path d="m12 1.5 4.5 4.5-4.5 4.5L7.5 6Z" />)}
      {radial([0, 90, 180, 270], <path d="m5.5 5.5 3 3-3 3-3-3Z" fillOpacity=".45" />)}
      <path d="m12 8 4 4-4 4-4-4Z" />
    </>
  ),
  dahlia: radial(
    [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330],
    <ellipse cx="12" cy="6.3" rx="1.9" ry="4.5" fillOpacity=".5" />,
  ),
  lotus: (
    <>
      <path d="M12 12C5 6 1 8 1.8 10.5 3 17 8 20 12 20Z" fillOpacity=".5" />
      <path d="M12 12c7-6 11-4 10.2-1.5C21 17 16 20 12 20Z" fillOpacity=".5" />
      <path d="M12 8C8 1 4 2 4 6c0 7 3 11 8 14Z" />
      <path d="M12 8c4-7 8-6 8-2 0 7-3 11-8 14Z" />
      <path d="M12 1c-5 6-5 13 0 19 5-6 5-13 0-19Z" fillOpacity=".55" />
    </>
  ),
  mandala: (
    <>
      <circle cx="12" cy="12" r="9.5" fillOpacity=".25" />
      {radial([0, 60, 120, 180, 240, 300], <circle cx="12" cy="8.4" r="5.3" fillOpacity=".3" />)}
    </>
  ),
  braid: (
    <>
      <path d="M4 2c12 0 0 15 16 15v5C-2 22 13 7 4 7Z" />
      <path d="M20 2C8 2 20 17 4 17v5C26 22 11 7 20 7Z" fillOpacity=".5" />
    </>
  ),
  gem: (
    <>
      <path d="m12 1.5 8 6v9l-8 6-8-6v-9Z" fillOpacity=".35" />
      <path d="m12 1.5 4 10.5-4 10.5L8 12Z" fillOpacity=".7" />
      <path d="m4 7.5 12 4.5-12 4.5ZM20 7.5 8 12l12 4.5Z" fillOpacity=".45" />
    </>
  ),
  eclipse: (
    <>
      <circle cx="11" cy="12" r="9.5" fillOpacity=".35" />
      <circle cx="14" cy="12" r="7.5" fillOpacity=".45" />
      <circle cx="16.4" cy="12" r="5.2" fillOpacity=".6" />
    </>
  ),
  gyre: radial([0, 90, 180, 270], <path d="M12 12C2 13 2 3 8 2c5-1 7 5 5 8-1-4-6-4-6-1 0 2 2 3 5 3Z" />),
  crossweave: (
    <>
      <path d="m5 2 7 10-7 10h14l-7-10 7-10Z" fillOpacity=".55" />
      <path d="m2 5 10 7 10-7v14l-10-7-10 7Z" fillOpacity=".55" />
    </>
  ),
  tessera: radial([0, 60, 120, 180, 240, 300], <path d="m12 2 8.6 5-3 5.2L9 7.2Z" />),
  triad: radial([0, 120, 240], <path d="M12 2C4 5 3 12 12 17c9-5 8-12 0-15Z" fillOpacity=".6" />),
};
