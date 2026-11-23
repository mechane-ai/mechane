import * as stylex from '@stylexjs/stylex';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { colors, spacing, typography } from '../../../foundations/src/tokens.stylex.ts';

const styles = stylex.create({
  image: { position: 'absolute', inset: 0, display: 'block', width: '100%', height: '100%', objectFit: 'cover' },
  placeholder: {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxSizing: 'border-box',
    padding: spacing.xs,
    overflow: 'hidden',
    color: colors.muted,
    backgroundColor: colors.canvas,
    fontFamily: typography.fontFamily,
    fontSize: typography.captionSize,
    lineHeight: typography.captionLineHeight,
    textAlign: 'center',
  },
});

/**
 * An image that fills the box its parent gives it, such as a tile with a fixed aspect ratio. It loads lazily, so
 * nothing moves as it arrives. An image that cannot load becomes a neutral placeholder that keeps the alt text.
 */
export function ImageFill({ src, alt }: { readonly src: string; readonly alt: string }): ReactNode {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);

  if (failedSrc === src) {
    return (
      <span role="img" aria-label={alt} {...stylex.props(styles.placeholder)}>
        <span aria-hidden>Image unavailable</span>
      </span>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      decoding="async"
      onError={() => setFailedSrc(src)}
      {...stylex.props(styles.image)}
    />
  );
}
