import { InstalledProcessCompletion } from '@mechane/sandbox-wire';
import type { InstalledCompletionCursor, InstalledCompletionPage, ProcessId } from '@mechane/sandbox-wire';
import { decodeFirst, decodeRows } from '@mechane/store';
import type { RecordsInput } from '@mechane/store';
import { Array, Option, Schema } from 'effect';

const PAGE_MAX_ROWS = 20;
const Row = Schema.Struct({ receipt: Schema.fromJsonString(InstalledProcessCompletion) });

type Identity = { readonly processId: ProcessId };
type Completion = typeof InstalledProcessCompletion.Type;
type Cursor = typeof InstalledCompletionCursor.Type;
type Page = typeof InstalledCompletionPage.Type;

type History = {
  readonly installedCompletion: (identity: Identity) => Option.Option<Completion>;
  readonly installedCompletions: (page: Cursor) => Page;
};

export function installedProcessCompletions({ sql }: RecordsInput): History {
  function installedCompletion({ processId }: Identity): Option.Option<Completion> {
    const cursor = sql.exec(
      "SELECT receipt FROM sandbox_completions WHERE execution_id=? AND kind='process' AND json_type(receipt,'$.origin')='object'",
      processId,
    );

    const stored = decodeFirst({ cursor, schema: Row });

    return Option.map(stored, ({ receipt }) => receipt);
  }

  function installedCompletions({ after }: Cursor): Page {
    const id = Option.getOrNull(after);

    const cursor = sql.exec(
      `SELECT receipt FROM sandbox_completions
       WHERE kind='process' AND json_type(receipt,'$.origin')='object'
       AND (? IS NULL OR rowid < (SELECT rowid FROM sandbox_completions WHERE execution_id=? AND kind='process'))
       ORDER BY rowid DESC LIMIT ?`,
      id,
      id,
      PAGE_MAX_ROWS + 1,
    );

    const rows = decodeRows({ cursor, schema: Row });
    const receipts = rows.slice(0, PAGE_MAX_ROWS).map(({ receipt }) => receipt);

    if (rows.length > PAGE_MAX_ROWS) {
      const last = Array.last(receipts);
      const nextAfter = Option.map(last, (receipt) => receipt.executionId);

      return { receipts, nextAfter };
    }

    return { receipts, nextAfter: Option.none() };
  }

  return { installedCompletion, installedCompletions };
}
