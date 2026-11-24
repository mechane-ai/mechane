import * as stylex from '@stylexjs/stylex';
import { announce } from '@ui-sdk/core';
import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { formatValue } from '../../../charts/src/index.ts';
import { Switch } from '../../../forms/src/index.ts';
import { colors, typography } from '../../../foundations/src/tokens.stylex.ts';
import { BoundValue } from './bound-value.tsx';
import type { LessonParam, LessonValue } from './define-lesson.ts';
import { InlineChoice } from './inline-choice.tsx';
import { useLessonScope } from './lesson-context.ts';
import type { LessonScope } from './lesson-context.ts';
import { LessonError } from './lesson-error.tsx';

/** How long a value rests, in milliseconds, before a screen reader hears it, so a drag is not read step by step. */
const SETTLE_MS = 700;

const styles = stylex.create({
  value: { fontVariantNumeric: 'tabular-nums', fontWeight: typography.mediumWeight, whiteSpace: 'nowrap' },
  frozen: { color: colors.ink },
  toggle: { display: 'inline-flex', verticalAlign: 'middle' },
});

/** The words a toggle's value reads as in prose. */
export type ValueLabels = { readonly on: string; readonly off: string };

const defaultValueLabels: ValueLabels = { on: 'on', off: 'off' };

export type ParamProps = {
  /** The param's name in the lesson. */
  readonly name: string;
};

export type ValueProps = {
  /** A param's or a derived value's name in the lesson. */
  readonly name: string;
  readonly labels?: Partial<ValueLabels> | undefined;
};

/** The param named `name`, or the inline error a part shows when the lesson declares none. */
export function lessonParam(
  scope: LessonScope,
  name: string,
): { readonly param: LessonParam } | { readonly error: string } {
  const param = new Map(Object.entries(scope.lesson.params)).get(name);

  return param === undefined
    ? {
        error: `Lesson "${scope.lesson.id}" has no param "${name}". Its params: ${Object.keys(scope.lesson.params).join(', ')}.`,
      }
    : { param };
}

/** A value as a reader sees it: a number in its format, an option's label, or a toggle's word. */
function valueText({
  param,
  value,
  locale,
  labels,
}: {
  readonly param: LessonParam;
  readonly value: LessonValue | undefined;
  readonly locale: string;
  readonly labels: ValueLabels;
}): string {
  switch (param.kind) {
    case 'number':
      return formatValue({ value: typeof value === 'number' ? value : null, locale, format: param.format });
    case 'choice':
      return param.options.find((option) => option.id === value)?.label ?? String(value);
    case 'toggle':
      return value === true ? labels.on : labels.off;
  }
}

/**
 * A param inside a sentence that the reader changes in place: a number to drag or step, an option picked from a short
 * list, or a switch. Every other part of the lesson that reads the name follows. A name the lesson lacks shows an
 * inline error; a read-only lesson shows the value as text.
 */
export function Param({ name }: ParamProps): ReactNode {
  const scope = useLessonScope('Param');
  const found = lessonParam(scope, name);

  if ('error' in found) {
    return <LessonError>{found.error}</LessonError>;
  }

  const { param } = found;
  const value = scope.state.values[name];
  const { isReadOnly } = scope.state;

  switch (param.kind) {
    case 'number':
      return isReadOnly ? (
        <span {...stylex.props(styles.value, styles.frozen)}>
          {valueText({ param, value, locale: scope.locale, labels: defaultValueLabels })}
        </span>
      ) : (
        <BoundValue
          value={typeof value === 'number' ? value : param.value}
          onValueChange={(next, details) => scope.api.apply(name, next, details)}
          min={param.min}
          max={param.max}
          step={param.step}
          scale={param.scale}
          locale={scope.locale}
          format={param.format}
          label={param.label}
        />
      );
    case 'choice':
      return (
        <InlineChoice
          param={param}
          value={typeof value === 'string' ? value : param.value}
          isDisabled={isReadOnly}
          onChange={(next, details) => scope.api.apply(name, next, details)}
        />
      );
    case 'toggle':
      return (
        <span {...stylex.props(styles.toggle)}>
          <Switch.Root
            checked={value === true}
            onCheckedChange={(next, details) => scope.api.apply(name, next, details)}
            disabled={isReadOnly}
            aria-label={param.label}
          >
            <Switch.Thumb />
          </Switch.Root>
        </span>
      );
  }
}

/** Tells assistive technology the text once it has rested, and never while a player moves the lesson. */
function useSettledAnnouncement(text: string, isPlaying: boolean): void {
  const heard = useRef(text);

  useEffect(() => {
    if (isPlaying || heard.current === text) {
      return;
    }

    const timer = globalThis.setTimeout(() => {
      heard.current = text;

      announce(text);
    }, SETTLE_MS);

    return () => globalThis.clearTimeout(timer);
  }, [text, isPlaying]);
}

/**
 * A param or derived value written in its declared format, inside a sentence. It updates on every change; assistive
 * technology hears it politely once it rests, so a drag or a player does not flood a screen reader.
 */
export function Value({ name, labels }: ValueProps): ReactNode {
  const scope = useLessonScope('Value');
  const derived = new Map(Object.entries(scope.lesson.derived)).get(name);
  const found = derived === undefined ? lessonParam(scope, name) : undefined;
  const value = scope.values[name];

  const text =
    derived === undefined
      ? found !== undefined && 'param' in found
        ? valueText({ param: found.param, value, locale: scope.locale, labels: { ...defaultValueLabels, ...labels } })
        : undefined
      : formatValue({ value: typeof value === 'number' ? value : null, locale: scope.locale, format: derived.format });

  const label = derived?.label ?? (found !== undefined && 'param' in found ? found.param.label : name);

  useSettledAnnouncement(text === undefined ? '' : `${label}: ${text}`, scope.state.playing !== null);

  if (text === undefined) {
    return <LessonError>{`Lesson "${scope.lesson.id}" has no param or derived value "${name}".`}</LessonError>;
  }

  return <span {...stylex.props(styles.value)}>{text}</span>;
}
