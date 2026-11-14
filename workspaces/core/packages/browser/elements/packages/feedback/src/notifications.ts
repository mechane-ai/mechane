import type { MouseEvent } from 'react';
import { toast as sonner } from 'sonner';
import type { ExternalToast } from 'sonner';

export type ToastId = string | number;

export type ToastAction = { readonly label: string; readonly onClick: (event: MouseEvent<HTMLButtonElement>) => void };

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

function options({ title: _title, shouldPersist, ...input }: ToastOptions): ExternalToast {
  const result: ExternalToast = {
    ...input,
    description: input.description,
    action: input.action ?? null,
    duration: 4000,
  };

  if (shouldPersist === true || input.action !== undefined) {
    result.duration = Infinity;
  }

  return result;
}

function success(input: ToastOptions): ToastId {
  return sonner.success(input.title, options(input));
}

function error(input: ToastOptions): ToastId {
  return sonner.error(input.title, options(input));
}

function info(input: ToastOptions): ToastId {
  return sonner.info(input.title, options(input));
}

function warning(input: ToastOptions): ToastId {
  return sonner.warning(input.title, options(input));
}

function loading(input: LoadingToastOptions): ToastId {
  return sonner.loading(input.title, { ...options(input), duration: Infinity });
}

function dismiss({ id }: DismissToastOptions): void {
  sonner.dismiss(id);
}

export const toast = { success, error, info, warning, loading, dismiss } as const;
