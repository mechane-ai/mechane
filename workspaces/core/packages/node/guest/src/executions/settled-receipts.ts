import { Bytes } from '@mechane/records';
import { ReceiptStatus } from '@mechane/sandbox-wire';
import type { SettledReceipt } from '@mechane/sandbox-wire';
import { Option } from 'effect';
import type { SettledReceipts } from './types.ts';

/** How many of the newest settled receipts keep their output's text; an earlier one keeps the rest. */
const RECEIPTS_WITH_TEXT = 64;

/**
 * The receipts of the settled executions, of which only the newest keep their output's text. The sandbox stores each
 * receipt the first time it sees it settled, so only a long-lived machine's memory needs the bound.
 */
export function settledReceipts(): SettledReceipts {
  const receipts = new Map<string, SettledReceipt>();
  const settledOrder: Array<string> = [];

  const keep: SettledReceipts['keep'] = ({ executionId, receipt }) => {
    receipts.set(executionId, receipt);
    settledOrder.push(executionId);

    if (settledOrder.length <= RECEIPTS_WITH_TEXT) {
      return;
    }

    // Each receipt kept adds one, so the earliest is the only one past the bound.
    const earliestId = Option.getOrThrow(Option.fromNullishOr(settledOrder.shift()));
    const earliest = Option.getOrThrow(Option.fromNullishOr(receipts.get(earliestId)));
    const omittedBytes = Bytes.make(earliest.output.omittedBytes + Buffer.byteLength(earliest.output.text));

    receipts.set(earliestId, { ...earliest, output: { text: '', omittedBytes } });
  };

  const receipt: SettledReceipts['receipt'] = ({ executionId }) =>
    Option.getOrElse(Option.fromNullishOr(receipts.get(executionId)), () => ({ state: ReceiptStatus.Running }));

  return { keep, receipt };
}
