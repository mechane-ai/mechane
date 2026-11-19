import { Timestamp } from '@mechane-ai/elements/collections';
import type { ReactNode } from 'react';

const timestampFormatter = new Intl.DateTimeFormat('en-US', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'UTC',
});

export function ManagedTimestamp({ value }: { readonly value: string }): ReactNode {
  const timestamp = new Date(value);

  if (Number.isNaN(timestamp.valueOf())) {
    return 'Unknown time';
  }

  return (
    <Timestamp dateTime={timestamp.toISOString()} label={`${timestampFormatter.format(timestamp)} UTC`} title={value} />
  );
}
