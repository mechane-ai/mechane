import { Schema } from 'effect';
import type { ManagedContext } from '../managed-context.ts';
import { runInstalledBash } from './run-installed-bash.ts';

type ActionInput<S extends Schema.Codec<unknown, unknown>> = {
  readonly resource: `/${string}`;
  readonly body: unknown;
  readonly schema: S;
};

function shellArgument(value: string): string {
  return `'${value.replaceAll("'", String.raw`'\''`)}'`;
}

export async function postInstalledAction<S extends Schema.Codec<unknown, unknown>>(
  context: ManagedContext,
  { resource, body, schema }: ActionInput<S>,
): Promise<S['Type']> {
  const path = shellArgument(resource.slice(1));
  const submit = `mechane-computer POST ${path} ${shellArgument(JSON.stringify(body))}`;

  // A pending action can only be dispatched again by its original work lease.
  const command = `(
    set -e
    submit() { ${submit}; }
    answer=$(submit)
    deadline=$((SECONDS + 60))
    while ((SECONDS < deadline)); do
      if jq -e '._tag == "ProcessPending" or (.progress._tag == "Pending" and .progress.isDispatchRequired)' >/dev/null <<< "$answer"; then
        sleep 0.2
        answer=$(submit)
      elif jq -e '.progress._tag == "Pending"' >/dev/null <<< "$answer"; then
        sleep 0.2
        answer=$(mechane-computer GET ${path})
      else
        printf '%s' "$answer"
        exit 0
      fi
    done
    printf 'Timed out waiting for the installed action\\n' >&2
    exit 1
  )`;

  const output = await runInstalledBash(context, { command });

  return Schema.decodeUnknownSync(Schema.fromJsonString(schema))(output);
}
