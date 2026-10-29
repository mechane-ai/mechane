type FolderPrefixPathInput = { readonly folder: string };

/** The prefix every path below a folder starts with: the folder and the slash after it. */
export function folderPrefixPath({ folder }: FolderPrefixPathInput): string {
  return `${folder}/`;
}
