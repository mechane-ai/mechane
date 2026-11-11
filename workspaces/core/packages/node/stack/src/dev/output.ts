type WriteDevOutputInput = { readonly text: string; readonly channel?: 'stdout' | 'stderr' };

export function writeDevOutput({ text, channel = 'stdout' }: WriteDevOutputInput): void {
  switch (channel) {
    case 'stdout':
      process.stdout.write(text);

      return;
    case 'stderr':
      process.stderr.write(text);
  }
}
