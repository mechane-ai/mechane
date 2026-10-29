import { Result } from 'effect';

type CapturePromiseInput<Value> = { readonly promise: Promise<Value> };

const PromiseSettlement = { Fulfilled: 'fulfilled', Rejected: 'rejected' } as const;

/** Captures either outcome as data, preserving the fulfilled value or rejection. */
export async function capturePromise<Value>({
  promise,
}: CapturePromiseInput<Value>): Promise<Result.Result<Value, unknown>> {
  const [settled] = await Promise.allSettled([promise]);

  switch (settled.status) {
    case PromiseSettlement.Fulfilled:
      return Result.succeed(settled.value);
    case PromiseSettlement.Rejected:
      return Result.fail(settled.reason);
  }
}
