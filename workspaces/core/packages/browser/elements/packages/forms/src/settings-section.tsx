import * as stylex from '@stylexjs/stylex';
import { useId } from 'react';
import type { ReactNode } from 'react';
import { Muted, Subheading } from '../../core/src/index.ts';
import { spacing } from '../../foundations/src/tokens.stylex.ts';

const styles = stylex.create({
  section: { display: 'grid', gap: spacing.md, minWidth: 0 },
  heading: { display: 'grid', gap: spacing.xs, minWidth: 0 },
});

export type SettingsSectionProps = {
  readonly title: string;
  readonly description?: string;
  readonly children: ReactNode;
};

export function SettingsSection({ title, description, children }: SettingsSectionProps): ReactNode {
  const titleId = useId();

  return (
    <section aria-labelledby={titleId} {...stylex.props(styles.section)}>
      <header {...stylex.props(styles.heading)}>
        <Subheading id={titleId}>{title}</Subheading>
        {description !== undefined && <Muted>{description}</Muted>}
      </header>
      <div>{children}</div>
    </section>
  );
}
