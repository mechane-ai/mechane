import * as stylex from '@stylexjs/stylex';
import { Pause, Play, StepBack, StepForward } from 'lucide-react';
import type { ReactNode } from 'react';
import { formatValue } from '../../../charts/src/index.ts';
import { IconButton } from '../../../core/src/index.ts';
import { Slider } from '../../../forms/src/index.ts';
import { colors, spacing, typography } from '../../../foundations/src/tokens.stylex.ts';
import { useLessonScope } from './lesson-context.ts';
import { LessonError } from './lesson-error.tsx';
import { lessonParam } from './param.tsx';
import { playerRange, usePlayback } from './playback.tsx';

const ICON_SIZE = 16;

const styles = stylex.create({
  transport: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    columnGap: spacing.sm,
    rowGap: spacing.xs,
    flexGrow: 1,
    minWidth: 0,
  },
  buttons: { display: 'flex', alignItems: 'center', gap: spacing.xs, flexShrink: 0 },
  readout: {
    minWidth: '4ch',
    color: colors.ink,
    fontFamily: typography.fontFamily,
    fontSize: typography.bodySize,
    fontVariantNumeric: 'tabular-nums',
    whiteSpace: 'nowrap',
  },
  scrub: { flex: '1 1 12rem', minWidth: 0 },
});

/** The accessible names of the transport's buttons. `{label}` in a name is replaced by the param's label. */
export type TransportLabels = {
  readonly play: string;
  readonly pause: string;
  readonly stepBack: string;
  readonly stepForward: string;
  readonly scrub: string;
};

const defaultLabels: TransportLabels = {
  play: 'Play {label}',
  pause: 'Pause {label}',
  stepBack: 'Step {label} back',
  stepForward: 'Step {label} forward',
  scrub: '{label}',
};

export type TransportProps = {
  /** The number param whose `Playback` this transport plays. */
  readonly for: string;
  readonly labels?: Partial<TransportLabels> | undefined;
};

/**
 * Play or pause, step back, step forward, a scrub slider and the value, in one row that wraps on a narrow screen. It
 * plays the `Playback` of the same param, and every button and the slider work from the keyboard.
 */
export function Transport({ for: name, labels }: TransportProps): ReactNode {
  const scope = useLessonScope('Transport');
  const player = usePlayback(name);
  const found = lessonParam(scope, name);

  if ('error' in found) {
    return <LessonError>{found.error}</LessonError>;
  }

  const { param } = found;

  if (param.kind !== 'number') {
    return <LessonError>{`Transport needs a number param, and "${name}" is a ${param.kind} param.`}</LessonError>;
  }

  const words = { ...defaultLabels, ...labels };

  function named(text: string): string {
    return text.replaceAll('{label}', param.label);
  }

  const stored = scope.state.values[name];
  const value = typeof stored === 'number' ? stored : param.value;
  const range = playerRange(scope, name, param);
  const hasPlayer = name in scope.state.players;
  const isDisabled = scope.state.isReadOnly;

  return (
    <div role="group" aria-label={named(words.scrub)} {...stylex.props(styles.transport)}>
      <div {...stylex.props(styles.buttons)}>
        <IconButton
          variant="ghost"
          aria-label={named(player.isPlaying ? words.pause : words.play)}
          disabled={isDisabled || !hasPlayer}
          onClick={(event) => player.toggle({ reason: 'press', event: event.nativeEvent })}
        >
          {player.isPlaying ? <Pause size={ICON_SIZE} /> : <Play size={ICON_SIZE} />}
        </IconButton>
        <IconButton
          variant="ghost"
          aria-label={named(words.stepBack)}
          disabled={isDisabled || value <= range.from}
          onClick={(event) => player.stepBy(-1, { reason: 'press', event: event.nativeEvent })}
        >
          <StepBack size={ICON_SIZE} />
        </IconButton>
        <IconButton
          variant="ghost"
          aria-label={named(words.stepForward)}
          disabled={isDisabled || value >= range.to}
          onClick={(event) => player.stepBy(1, { reason: 'press', event: event.nativeEvent })}
        >
          <StepForward size={ICON_SIZE} />
        </IconButton>
        <span aria-hidden {...stylex.props(styles.readout)}>
          {formatValue({ value, locale: scope.locale, format: param.format })}
        </span>
      </div>
      <Slider.Root<number>
        locale={scope.locale}
        value={Math.min(range.to, Math.max(range.from, value))}
        onValueChange={(next, details) => player.seek(next, details)}
        min={range.from}
        max={range.to}
        step={param.step}
        format={param.format}
        disabled={isDisabled}
        xstyle={styles.scrub}
      >
        <Slider.Control>
          <Slider.Track>
            <Slider.Indicator />
          </Slider.Track>
          <Slider.Thumb aria-label={named(words.scrub)} />
        </Slider.Control>
      </Slider.Root>
    </div>
  );
}
