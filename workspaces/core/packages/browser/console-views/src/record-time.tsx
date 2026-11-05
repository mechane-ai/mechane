import { Timestamp } from '@mechane-ai/elements/collections';
import { DateTime } from 'effect';
import type { ReactNode } from 'react';
import { preciseTimeLabel } from './format.ts';

export function ConsoleTimestamp({ value }: { readonly value: DateTime.Utc }): ReactNode {
  const date = DateTime.toDateUtc(value);

  const label = date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'UTC',
  });

  const title = date.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    fractionalSecondDigits: 3,
    timeZone: 'UTC',
    timeZoneName: 'short',
  });

  return <Timestamp dateTime={preciseTimeLabel(value)} label={label} title={title} />;
}
