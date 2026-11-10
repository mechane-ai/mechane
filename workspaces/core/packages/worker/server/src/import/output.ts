type WriteImportOutputInput = { readonly line: string };

export function writeImportOutput({ line }: WriteImportOutputInput): void {
  process.stdout.write(`${line}\n`);
}

export function failImport({ line }: WriteImportOutputInput): void {
  process.stderr.write(`${line}\n`);

  process.exitCode = 1;
}
