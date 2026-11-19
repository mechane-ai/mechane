import { problemMessage } from '@mechane/console-data';
import { useRef, useState } from 'react';
import { useScreenLifetime } from './use-screen-lifetime.ts';

export function useManagedCommand() {
  const [pending, setPending] = useState<string>();
  const [error, setError] = useState<string>();
  const sending = useRef(false);
  const isCurrent = useScreenLifetime();

  function run<Value>(name: string, execute: () => Promise<Value>, done?: (value: Value) => void): void {
    if (sending.current) {
      return;
    }

    sending.current = true;

    setPending(name);
    setError(undefined);

    async function executeCommand(): Promise<void> {
      const [result] = await Promise.allSettled([execute()]);
      sending.current = false;

      if (!isCurrent()) {
        return;
      }

      setPending(undefined);

      if (result.status === 'fulfilled') {
        done?.(result.value);
      } else {
        setError(problemMessage(result.reason));
      }
    }

    void executeCommand();
  }

  return { pending, error, run };
}
