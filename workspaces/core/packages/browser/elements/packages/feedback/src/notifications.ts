import { createToaster } from '@ui-sdk/react/toast';
import type { ToastActionData, Toaster, ToastType } from '@ui-sdk/react/toast';
import type { ReactNode } from 'react';

export type ToastId = string | number;

export type ToastAction = {
  readonly label: string;
  readonly shouldDismiss?: boolean;
  readonly onClick: NonNullable<ToastActionData['onAction']>;
};

export type ToastOptions = {
  readonly title: string;
  readonly description?: string;
  readonly id?: ToastId;
  readonly action?: ToastAction;
  readonly toasterId?: string;
  readonly shouldPersist?: boolean;
};

export type LoadingToastOptions = ToastOptions & { readonly id: ToastId };
export type DismissToastOptions = { readonly id: ToastId };

const MILLISECONDS_PER_SECOND = 1000;
const notificationDurationSeconds = 4;

function createNotificationQueues() {
  const defaultQueue = createToaster();
  const scopes = new Map<string, Toaster<ReactNode>>();

  function queueFor(scope?: string) {
    if (scope === undefined) {
      return defaultQueue;
    }

    const current = scopes.get(scope);

    if (current !== undefined) {
      return current;
    }

    const queue = createToaster();

    if (typeof document !== 'undefined') {
      scopes.set(scope, queue);
    }

    return queue;
  }

  function bind(scope: string | undefined, queue: Toaster<ReactNode>) {
    if (scope === undefined) {
      return;
    }

    scopes.set(scope, queue);

    return () => {
      if (scopes.get(scope) === queue) {
        scopes.delete(scope);
      }
    };
  }

  function dismiss(id: string) {
    defaultQueue.dismiss(id);

    for (const queue of scopes.values()) {
      queue.dismiss(id);
    }
  }

  return { queueFor, bind, dismiss };
}

export const notificationQueues = createNotificationQueues();

function sdkId(id: ToastId): string {
  return typeof id === 'number' ? `#${id}` : id.replace(/^#/, '##');
}

function notify(type: ToastType, { id, toasterId, title, description, action, shouldPersist }: ToastOptions): ToastId {
  const queue = notificationQueues.queueFor(toasterId);

  const assigned = queue({
    ...(id !== undefined && { id: sdkId(id) }),
    type,
    title,
    description,
    action: {
      label: action?.label,
      dismiss: action?.shouldDismiss ?? true,
      ...(action !== undefined && { onAction: action.onClick }),
    },
    duration:
      shouldPersist === true || action !== undefined || type === 'loading'
        ? Infinity
        : notificationDurationSeconds * MILLISECONDS_PER_SECOND,
  });

  return id ?? assigned;
}

export const toast = {
  success: (input: ToastOptions) => notify('success', input),
  error: (input: ToastOptions) => notify('error', input),
  info: (input: ToastOptions) => notify('info', input),
  warning: (input: ToastOptions) => notify('warning', input),
  loading: (input: LoadingToastOptions) => notify('loading', input),
  dismiss: ({ id }: DismissToastOptions) => notificationQueues.dismiss(sdkId(id)),
} as const;
