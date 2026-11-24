import * as stylex from '@stylexjs/stylex';
import { matchesShortcut } from '@ui-sdk/core';
import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { Button } from '../../../core/src/index.ts';
import { colors, spacing, typography } from '../../../foundations/src/tokens.stylex.ts';
import { useLessonContext } from '../lesson/use-lesson.ts';
import { lessonBeat } from './beat.tsx';
import type { ViewProps } from './view-essay.tsx';

/** Where an arrow key belongs to the control under it, such as a slider or a radio group. */
const ARROW_OWNERS =
  'input, textarea, select, [contenteditable="true"], [role="slider"], [role="radio"], [role="radiogroup"], [role="tab"], [role="combobox"], [role="spinbutton"], [role="listbox"], [role="menu"], [role="grid"], [role="application"]';

/** Where the space bar belongs to the control under it, such as a button or a link. */
const SPACE_OWNERS = `${ARROW_OWNERS}, button, a, summary, [role="button"], [role="checkbox"], [role="switch"], [role="link"]`;

const styles = stylex.create({
  root: { display: 'grid', gridTemplateRows: 'auto minmax(0, 1fr) auto', minHeight: '100dvh', rowGap: spacing.lg },
  top: {
    display: 'flex',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: spacing.sm,
    paddingBlock: spacing.md,
    borderBlockEndWidth: 1,
    borderBlockEndStyle: 'solid',
    borderBlockEndColor: colors.line,
    color: colors.muted,
    fontSize: typography.bodySize,
    lineHeight: typography.bodyLineHeight,
  },
  title: { margin: 0, color: colors.ink, fontWeight: typography.mediumWeight },
  position: { margin: 0, fontVariantNumeric: 'tabular-nums' },
  slide: { minWidth: 0, paddingBlockStart: spacing.lg },
  bottom: {
    display: 'grid',
    gap: spacing.md,
    position: 'sticky',
    insetBlockEnd: 0,
    paddingBlock: spacing.md,
    backgroundColor: colors.surface,
  },
  bar: { display: 'flex', gap: spacing.xxs, minWidth: 0 },
  segment: {
    flexGrow: 1,
    flexBasis: 0,
    blockSize: spacing.xxs,
    borderRadius: spacing.xxs,
    backgroundColor: colors.line,
  },
  done: { backgroundColor: colors.ink },
  controls: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: spacing.md },
  hint: { color: colors.faint, fontSize: typography.captionSize, textAlign: 'center' },
});

function isOwnedBy(target: EventTarget | null, selector: string): boolean {
  return target instanceof Element && target.closest(selector) !== null;
}

/**
 * The present view: one beat per slide, with its notes, walked by Right, Space and Left through scrolly steps, reveal
 * steps and beats. Moving to a beat shows its first declared state, coming back included; a scrolly step lays its
 * values over that state, so on entry its first step wins. Keys inside a control, such as a slider, stay with it.
 */
export function PresentView({ article, children }: ViewProps): ReactNode {
  const { beat, step, next, previous, lesson } = useLessonContext();
  const rootRef = useRef<HTMLDivElement>(null);
  const controls = useRef({ next, previous });
  const shownBeat = useRef(beat);
  const beats = lesson.beats;
  const index = beats.findIndex((item) => item.id === beat);
  const current = lessonBeat(lesson, beat ?? '');
  const added = article.outline.beats.find((item) => item.id === beat)?.scrollySteps.length ?? 0;
  const steps = (current?.steps ?? 0) + Math.max(0, added - 1);
  const isFirst = index <= 0 && step === 0;
  const isLast = index === beats.length - 1 && step >= steps;
  const { labels } = article;
  const place = `${labels.beat} ${index + 1} ${labels.of} ${beats.length}`;
  const stepText = steps > 0 ? `, ${labels.step} ${step + 1} ${labels.of} ${steps + 1}` : '';

  useEffect(() => {
    controls.current = { next, previous };
  });

  useEffect(() => {
    if (shownBeat.current !== beat) {
      shownBeat.current = beat;

      rootRef.current?.scrollIntoView({ block: 'start' });
    }
  }, [beat]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent): void {
      const isForward = matchesShortcut(event, 'ArrowRight');
      const isSpace = matchesShortcut(event, 'Space');
      const isBack = matchesShortcut(event, 'ArrowLeft');
      const owner = isSpace ? SPACE_OWNERS : ARROW_OWNERS;
      const isKey = isForward || isSpace || isBack;
      const isOurs = isKey && !event.defaultPrevented;

      if (!isOurs || isOwnedBy(event.target, owner)) {
        return;
      }

      event.preventDefault();

      if (isBack) {
        controls.current.previous({ reason: 'shortcut', event });
      } else {
        controls.current.next({ reason: 'shortcut', event });
      }
    }

    document.addEventListener('keydown', onKeyDown);

    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  return (
    <>
      <div ref={rootRef} {...stylex.props(styles.root)}>
        <div {...stylex.props(styles.top)}>
          <p {...stylex.props(styles.title)}>{article.title}</p>
          <p aria-live="polite" {...stylex.props(styles.position)}>{`${place}${stepText}`}</p>
        </div>
        <div {...stylex.props(styles.slide)}>{children}</div>
        <div {...stylex.props(styles.bottom)}>
          <div aria-hidden {...stylex.props(styles.bar)}>
            {beats.map((item, position) => (
              <span key={item.id} {...stylex.props(styles.segment, position <= index && styles.done)} />
            ))}
          </div>
          <div {...stylex.props(styles.controls)}>
            <Button
              density="compact"
              disabled={isFirst}
              focusableWhenDisabled
              onClick={(event) => previous({ reason: 'press', event: event.nativeEvent })}
            >
              {labels.previous}
            </Button>
            <span aria-hidden {...stylex.props(styles.hint)}>
              ← →
            </span>
            <Button
              density="compact"
              variant="solid"
              disabled={isLast}
              focusableWhenDisabled
              onClick={(event) => next({ reason: 'press', event: event.nativeEvent })}
            >
              {labels.next}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
