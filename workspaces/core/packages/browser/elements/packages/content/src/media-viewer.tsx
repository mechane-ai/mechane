import * as stylex from '@stylexjs/stylex';
import type { ReactNode } from 'react';
import { colors } from '../../foundations/src/tokens.stylex.ts';
import { viewerStyles } from './viewer-styles.ts';

export type MediaViewerProps = {
  readonly kind: 'image' | 'video';
  readonly src: string;
  readonly label: string;
  readonly widthPixels: number;
  readonly heightPixels: number;
  readonly onError?: () => void;
};

const styles = stylex.create({
  viewport: {
    display: 'grid',
    placeItems: 'center',
    width: '100%',
    aspectRatio: '16 / 9',
    maxHeight: '70dvh',
    minWidth: 0,
    overflow: 'hidden',
    backgroundColor: colors.canvas,
  },
  placeholder: { backgroundColor: colors.line },
  media: { display: 'block', width: '100%', height: '100%', minHeight: 0, objectFit: 'contain' },
});

export function MediaViewerPlaceholder(): ReactNode {
  return <div aria-hidden {...stylex.props(viewerStyles.root, styles.viewport, styles.placeholder)} />;
}

export function MediaViewer({ kind, src, label, widthPixels, heightPixels, onError }: MediaViewerProps): ReactNode {
  return (
    <div {...stylex.props(viewerStyles.root, styles.viewport)}>
      {kind === 'image' ? (
        <img
          src={src}
          alt={label}
          width={widthPixels}
          height={heightPixels}
          onError={onError}
          {...stylex.props(styles.media)}
        />
      ) : (
        <video
          src={src}
          aria-label={label}
          width={widthPixels}
          height={heightPixels}
          controls
          muted
          playsInline
          preload="metadata"
          onError={onError}
          {...stylex.props(styles.media)}
        />
      )}
    </div>
  );
}
