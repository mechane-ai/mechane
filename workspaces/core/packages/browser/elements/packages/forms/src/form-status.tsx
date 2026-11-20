import { definePrimitive } from '@ui-sdk/core';
import { createParts } from '@ui-sdk/react/primitive';
import type { ReactNode } from 'react';
import { Status } from '../../core/src/index.ts';

export type FormStatusProps = {
  readonly status: 'pending' | 'error' | 'success';
  /** The public result shown to the user. */
  readonly message: string;
};

function submissionState({ status, message }: FormStatusProps) {
  return { status, message };
}

const formStatus = definePrimitive({
  name: 'form-status',
  options: { status: 'string', message: 'string' },
  state: submissionState,
  sync: submissionState,
  controlled: ['status', 'message'],
  api: () => ({}),
  slots: (slot) => ({ root: slot({}) }),
  agent: { actions: [] },
});

const parts = createParts(formStatus, { root: 'span' });

const tones = { pending: 'warning', error: 'negative', success: 'positive' } as const;

export function FormStatus({ status, message }: FormStatusProps): ReactNode {
  return (
    <parts.Root
      status={status}
      message={message}
      role={status === 'error' ? 'alert' : 'status'}
      render={<Status tone={tones[status]} />}
    >
      {message}
    </parts.Root>
  );
}
