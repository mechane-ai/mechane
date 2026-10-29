import { Duration } from 'effect';

/** How long a wait lasts. */
type WaitForInput = { readonly span: Duration.Duration };

/** Waits out `span`; the one place an object's code waits on time alone. */
export async function waitFor({ span }: WaitForInput): Promise<void> {
  const wakeAfter: (resolve: () => void) => void = (resolve) => {
    setTimeout(resolve, Duration.toMillis(span));
  };

  await new Promise<void>(wakeAfter);
}
