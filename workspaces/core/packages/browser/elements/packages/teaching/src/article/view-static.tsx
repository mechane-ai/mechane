import * as stylex from '@stylexjs/stylex';
import type { ReactNode } from 'react';
import { colors, spacing, typography } from '../../../foundations/src/tokens.stylex.ts';
import { articleLayout } from './article-layout.stylex.ts';
import { lessonBeat } from './beat.tsx';
import { ArticleNotes } from './notes.tsx';
import type { ViewProps } from './view-essay.tsx';

const styles = stylex.create({
  root: { minWidth: 0 },
  contents: {
    maxWidth: articleLayout.measure,
    marginBlock: spacing.xl,
    color: colors.muted,
    fontSize: typography.bodySize,
    lineHeight: typography.bodyLineHeight,
  },
  heading: { margin: 0, color: colors.ink, fontWeight: typography.strongWeight },
  list: { margin: 0, paddingInlineStart: spacing.xl },
});

/**
 * The static view: every beat open at its first state, every reveal shown, each figure followed by its description, and
 * nothing that needs a script to be read. Feed readers, printers and readers without JavaScript get this view.
 */
export function StaticView({ article, header, children }: ViewProps): ReactNode {
  const beats = article.outline.beats.flatMap((item) => lessonBeat(article.lesson, item.id) ?? []);

  return (
    <div {...stylex.props(styles.root)}>
      {header}
      <nav aria-label={article.labels.contents} {...stylex.props(styles.contents)}>
        <p {...stylex.props(styles.heading)}>{article.labels.contents}</p>
        <ol {...stylex.props(styles.list)}>
          {beats.map((beat) => (
            <li key={beat.id}>
              <a href={`#${encodeURIComponent(beat.id)}`}>{beat.title}</a>
            </li>
          ))}
        </ol>
      </nav>
      {children}
      <ArticleNotes />
    </div>
  );
}
