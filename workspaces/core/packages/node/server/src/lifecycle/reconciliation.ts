const RECONCILIATION_INTERVAL_MS = 1000;

export function startReconciliation(reconcile: () => Promise<void>): () => Promise<void> {
  const state: { timer: ReturnType<typeof setTimeout> | null; pending: Promise<void> | null; isStopped: boolean } = {
    timer: null,
    pending: null,
    isStopped: false,
  };

  async function tick(): Promise<void> {
    try {
      await reconcile();
    } catch {
      console.error({ event: 'notification.reconciliation_failed' });
    } finally {
      state.pending = null;

      if (!state.isStopped) {
        schedule();
      }
    }
  }

  function schedule(): void {
    state.timer = setTimeout(() => {
      state.timer = null;
      state.pending = tick();
    }, RECONCILIATION_INTERVAL_MS);

    state.timer.unref();
  }

  schedule();

  return async function stopReconciliation(): Promise<void> {
    state.isStopped = true;

    if (state.timer !== null) {
      clearTimeout(state.timer);
    }

    await state.pending;
  };
}
