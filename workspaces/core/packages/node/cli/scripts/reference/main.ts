import { commandReference, CommandReference } from '@mechane/commands';
import { jsonFileText } from '@mechane/program';
import { RELEASE } from '@mechane/protocol';

/** Prints the command reference that the command model generates, the document `reference.json` commits. */
function main(): void {
  process.stdout.write(jsonFileText({ schema: CommandReference, value: commandReference({ release: RELEASE }) }));
}

main();
