import { Bytes } from '@mechane/records';
import type { ExecutionRequest, SettledReceipt } from '@mechane/sandbox-wire';
import { Option, Record, Redacted } from 'effect';

type RedactExecutionOutputInput = {
  readonly output: SettledReceipt['output'];
  readonly request: Pick<ExecutionRequest, 'environment'>;
};

type PrefixInput = { readonly omittedBytes: Bytes; readonly secrets: ReadonlyArray<string> };
type SuffixInput = { readonly text: string; readonly secrets: ReadonlyArray<string> };

/** Redacts injected values before retention, including a possible credential suffix at a truncated tail's start. */
export function redactExecutionOutput({ output, request }: RedactExecutionOutputInput): SettledReceipt['output'] {
  const access = Option.getOrElse(request.environment, () => ({ variables: {}, secrets: {} }));
  const values = Record.values(access.secrets);
  const secrets = values.map(Redacted.value).filter((value) => value.length > 0);
  const longestFirst = secrets.toSorted((left, right) => right.length - left.length);
  const hiddenPrefix = redactionPrefix({ omittedBytes: output.omittedBytes, secrets });
  const prefix = output.text.slice(0, hiddenPrefix);
  let text = output.text.slice(hiddenPrefix);

  for (const value of longestFirst) {
    text = text.replaceAll(value, '[redacted]');
  }

  const suffixLength = redactionSuffix({ text, secrets });

  const redacted: string = (() => {
    if (suffixLength > 0) {
      return text.slice(0, -suffixLength);
    }

    return text;
  })();

  const prefixBytes = Buffer.byteLength(prefix);
  const omittedBytes = Bytes.make(output.omittedBytes + prefixBytes);

  return { text: redacted, omittedBytes };
}

function redactionSuffix({ text, secrets }: SuffixInput): number {
  const suffix: (secret: string) => number = (secret) => {
    for (let prefix = secret.slice(0, -1); prefix.length > 0; prefix = prefix.slice(0, -1)) {
      if (text.endsWith(prefix)) {
        return prefix.length;
      }
    }

    return 0;
  };

  const lengths = secrets.map(suffix);

  return Math.max(0, ...lengths);
}

function redactionPrefix({ omittedBytes, secrets }: PrefixInput): number {
  if (omittedBytes === 0) {
    return 0;
  }

  const lengths = secrets.map((value) => value.length);

  return Math.max(0, ...lengths);
}
