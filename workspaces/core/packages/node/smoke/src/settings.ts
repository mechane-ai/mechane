const PROGRAM_ARGUMENTS_START = 2;

export function smokeSettings() {
  const filter = process.argv.slice(PROGRAM_ARGUMENTS_START);

  if (filter.length > 1) {
    throw new Error('The smoke accepts at most one scenario-name filter');
  }

  return { match: filter[0], nodeExecutable: process.env['MECHANE_NODE_EXECUTABLE'] ?? process.execPath };
}
