import { Effect, Option, Result, Schema } from 'effect';
import type { Duration } from 'effect';
import type { ApprovalNotice } from './types.ts';

/**
 * The line with which a waiting CLI names, on standard error, the device page and the code to type there once signed
 * in. The pattern captures the page and the code.
 */
const APPROVAL_NOTICE = /^.*open (\S+), sign in, and type the code (\S+).*$/m;

/** A waiting CLI's notice, as its pattern matches it: the whole line, the device page and the code to type there. */
const NoticeMatch = Schema.Tuple([Schema.String, Schema.URLFromString, Schema.String]);

type NoticeMatch = typeof NoticeMatch.Type;

/** What a waiting CLI has written to standard error so far, and how often to read it again. */
type AwaitNoticeInput = { readonly stderr: () => string; readonly interval: Duration.Duration };

type WrittenNoticeInput = { readonly text: string };

/**
 * Reads what a waiting CLI wrote to standard error each interval until its notice names the device page and the code to
 * type there. A caller races it with the CLI's exit, since a CLI that fails first writes none.
 */
export const awaitNotice = Effect.fn('awaitNotice')(function* ({
  stderr,
  interval,
}: AwaitNoticeInput): Effect.fn.Return<ApprovalNotice> {
  let notice = writtenNotice({ text: stderr() });

  while (Option.isNone(notice)) {
    yield* Effect.sleep(interval);

    notice = writtenNotice({ text: stderr() });
  }

  return notice.value;
});

/** The notice the text holds, none until the CLI has written its whole line. */
function writtenNotice({ text }: WrittenNoticeInput): Option.Option<ApprovalNotice> {
  const match = Schema.decodeUnknownResult(NoticeMatch)(APPROVAL_NOTICE.exec(text));

  if (Result.isFailure(match)) {
    return Option.none();
  }

  const [line, url, userCode] = match.success;

  return Option.some({ line, url, userCode });
}
