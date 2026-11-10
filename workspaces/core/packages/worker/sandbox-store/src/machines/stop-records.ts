import type { SandboxOperationId } from '@mechane/records';
import { SandboxStopReceipt } from '@mechane/sandbox-wire';
import { decodeFirst, decodeOne } from '@mechane/store';
import type { RecordsInput } from '@mechane/store';
import { Option, Schema } from 'effect';

type StopIdentity = { readonly operationId: SandboxOperationId };
const ReceiptJson = Schema.fromJsonString(SandboxStopReceipt);
const StopRow = Schema.Struct({ receipt: ReceiptJson });

/** Stop receipts remain inspectable after failure, machine loss, and a later stop request. */
export function stopRecords({ sql }: RecordsInput) {
  function sandboxStop({ operationId }: StopIdentity): Option.Option<SandboxStopReceipt> {
    const cursor = sql.exec('SELECT receipt FROM sandbox_stops WHERE operation_id = ?', operationId);
    const row = decodeFirst({ cursor, schema: StopRow });

    return Option.map(row, ({ receipt }) => receipt);
  }

  function latestSandboxStop(): Option.Option<SandboxStopReceipt> {
    const cursor = sql.exec(
      "SELECT receipt FROM sandbox_stops ORDER BY COALESCE((SELECT rowid FROM machines WHERE id = json_extract(receipt, '$.machine_id')), 0) DESC, rowid DESC LIMIT 1",
    );

    const row = decodeFirst({ cursor, schema: StopRow });

    return Option.map(row, ({ receipt }) => receipt);
  }

  function claimSandboxStop({ operationId, ...fields }: SandboxStopReceipt): SandboxStopReceipt {
    const value = Schema.encodeSync(ReceiptJson)({ operationId, ...fields });

    sql.exec(
      'INSERT INTO sandbox_stops (operation_id, receipt) VALUES (?, ?) ON CONFLICT DO NOTHING',
      operationId,
      value,
    );

    const cursor = sql.exec('SELECT receipt FROM sandbox_stops WHERE operation_id = ?', operationId);

    return decodeOne({ cursor, schema: StopRow }).receipt;
  }

  function saveSandboxStop({ operationId, ...fields }: SandboxStopReceipt): void {
    const value = Schema.encodeSync(ReceiptJson)({ operationId, ...fields });

    sql.exec(
      "UPDATE sandbox_stops SET receipt = ? WHERE operation_id = ? AND json_extract(receipt, '$.phase') <> 'completed'",
      value,
      operationId,
    );
  }

  return { sandboxStop, latestSandboxStop, claimSandboxStop, saveSandboxStop };
}
