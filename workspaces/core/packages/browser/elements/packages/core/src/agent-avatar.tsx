import * as stylex from '@stylexjs/stylex';
import type { ReactNode } from 'react';
import { avatarColors } from '../../foundations/src/tokens.stylex.ts';
import { agentAvatarGlyphs, seededAgentAvatarShapes } from './agent-avatar-glyphs.tsx';
import type { AgentAvatarShape } from './agent-avatar-glyphs.tsx';

const seededAgentAvatarColors = Object.freeze([
  'ember',
  'coral',
  'rose',
  'berry',
  'plum',
  'orchid',
  'violet',
  'indigo',
  'iris',
  'cobalt',
  'blue',
  'sky',
  'cyan',
  'lagoon',
  'teal',
  'jade',
  'mint',
  'forest',
  'leaf',
  'moss',
  'olive',
  'ochre',
  'amber',
  'copper',
] as const);

export const agentAvatarColors = seededAgentAvatarColors;

export type AgentAvatarColor = (typeof agentAvatarColors)[number];
export type AgentAvatarSize = 'xs' | 'sm' | 'md' | 'lg';
export type AgentAppearance = { readonly shape: AgentAvatarShape; readonly color: AgentAvatarColor };

const styles = stylex.create({
  root: { display: 'inline-flex', flexShrink: 0, verticalAlign: 'middle' },
  xs: { width: 16, height: 16 },
  sm: { width: 20, height: 20 },
  md: { width: 24, height: 24 },
  lg: { width: 40, height: 40 },
  ember: { color: avatarColors.identity1 },
  coral: { color: avatarColors.identity2 },
  rose: { color: avatarColors.identity3 },
  berry: { color: avatarColors.identity4 },
  plum: { color: avatarColors.identity5 },
  orchid: { color: avatarColors.identity6 },
  violet: { color: avatarColors.identity7 },
  indigo: { color: avatarColors.identity8 },
  iris: { color: avatarColors.identity9 },
  cobalt: { color: avatarColors.identity10 },
  blue: { color: avatarColors.identity11 },
  sky: { color: avatarColors.identity12 },
  cyan: { color: avatarColors.identity13 },
  lagoon: { color: avatarColors.identity14 },
  teal: { color: avatarColors.identity15 },
  jade: { color: avatarColors.identity16 },
  mint: { color: avatarColors.identity17 },
  forest: { color: avatarColors.identity18 },
  leaf: { color: avatarColors.identity19 },
  moss: { color: avatarColors.identity20 },
  olive: { color: avatarColors.identity21 },
  ochre: { color: avatarColors.identity22 },
  amber: { color: avatarColors.identity23 },
  copper: { color: avatarColors.identity24 },
});

const sizes = { xs: styles.xs, sm: styles.sm, md: styles.md, lg: styles.lg } satisfies Record<
  AgentAvatarSize,
  stylex.StyleXStyles
>;

const palettes = {
  ember: styles.ember,
  coral: styles.coral,
  rose: styles.rose,
  berry: styles.berry,
  plum: styles.plum,
  orchid: styles.orchid,
  violet: styles.violet,
  indigo: styles.indigo,
  iris: styles.iris,
  cobalt: styles.cobalt,
  blue: styles.blue,
  sky: styles.sky,
  cyan: styles.cyan,
  lagoon: styles.lagoon,
  teal: styles.teal,
  jade: styles.jade,
  mint: styles.mint,
  forest: styles.forest,
  leaf: styles.leaf,
  moss: styles.moss,
  olive: styles.olive,
  ochre: styles.ochre,
  amber: styles.amber,
  copper: styles.copper,
} satisfies Record<AgentAvatarColor, stylex.StyleXStyles>;

export function agentAppearance(seed: string): AgentAppearance {
  const hash = Array.from(seed).reduce(
    (value, character) => (value * 31 + (character.codePointAt(0) ?? 0)) % 2_147_483_647,
    0,
  );

  return {
    shape: seededAgentAvatarShapes[hash % seededAgentAvatarShapes.length] ?? 'spark',
    color:
      seededAgentAvatarColors[Math.floor(hash / seededAgentAvatarShapes.length) % seededAgentAvatarColors.length] ??
      'ember',
  };
}

export type AgentAvatarProps = {
  readonly seed: string;
  readonly appearance?: AgentAppearance | undefined;
  readonly size?: AgentAvatarSize;
  readonly label?: string;
};

export function AgentAvatar({ seed, appearance, size = 'sm', label }: AgentAvatarProps): ReactNode {
  const selected = appearance ?? agentAppearance(seed);

  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      role={label === undefined ? undefined : 'img'}
      aria-label={label}
      aria-hidden={label === undefined ? true : undefined}
      {...stylex.props(styles.root, sizes[size], palettes[selected.color])}
    >
      {agentAvatarGlyphs[selected.shape]}
    </svg>
  );
}
